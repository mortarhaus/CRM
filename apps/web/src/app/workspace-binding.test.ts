import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createS3Adapter, type StorageAdapter } from "@/adapters/storage";
import { startMinio, type TestMinio } from "@/test/minio";
import { startDatabase, type TestDatabase } from "@/test/postgres";

// PR 76 Review R1 P0, made shared (DECISIONS 2026-11-25): every bound action, through action() on the real crm_app
// role, a real MinIO and real pg-boss tables. One Owner is a member of two workspaces whose versions match (settings at
// 1, templates at 0, a service at 1 in each); the session has switched to the second. A post from a page rendered for
// the first is refused with WORKSPACE_CHANGED and changes nothing in either workspace: no row, audit entry, step-up,
// notification, idempotency key, job, rate-limit unit, storage object or Better Auth call. The same post from a page
// rendered for the second is done, in the second only.
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl, AUTH_SECRET: "binding test secret, not a real key" }) }));
let signedIn: { userId: string; sessionId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && {
      user: { id: signedIn.userId, twoFactorEnabled: true },
      session: { id: signedIn.sessionId, activeOrganizationId: signedIn.workspaceId },
    },
}));
// Step-up's code check posts to Better Auth (lib/auth/step-up.ts, tested against it there); here it accepts any code.
const authPosts = vi.fn(async () => ({ ok: true, status: 200, code: undefined, data: null }));
vi.mock("@/lib/auth/forward", () => ({ postToAuth: authPosts }));
let puts = 0;
let realStorage: StorageAdapter;
vi.mock("@/adapters/storage", async (original) => ({
  ...(await original<typeof import("@/adapters/storage")>()),
  getStorage: () => ({
    ...realStorage,
    put: (...args: Parameters<StorageAdapter["put"]>) => {
      puts += 1;
      return realStorage.put(...args);
    },
  }),
}));

const { createServiceAction, setServiceArchivedAction, updateServiceAction } = await import("./(app)/catalog/actions");
const { updateBrandingSettings, updateGeneralSettings } = await import("./(app)/settings/actions");
const { uploadLogo } = await import("./(app)/settings/branding/actions");
const { sendTestEmail } = await import("./(app)/settings/email/actions");
const { updateNumberingSettings } = await import("./(app)/settings/numbering/actions");
const { confirmStepUp, saveBankDetails, uploadPaymentQr } = await import("./(app)/settings/payment/actions");
const { saveEmailTemplateAction } = await import("./(app)/settings/templates/actions");
const { completeOnboarding } = await import("./(onboarding)/onboarding/actions");

let database: TestDatabase;
let minio: TestMinio;
let admin: postgres.Sql;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1]);

interface Page {
  // The workspace the page was rendered for, and that workspace's service (the catalog edit page).
  workspaceId: string;
  serviceId: string;
}

function form(page: Page, fields: Record<string, string | File>): FormData {
  const data = new FormData();
  data.set("workspaceId", page.workspaceId);
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const png = () => new File([PNG], "image.png", { type: "image/png" });
const service = { name: "Design sprint", description: "Two days.", price: "100.00", currency: "MYR", unit: "day", taxable: "on" };

// Each bound action as its page posts it. onboarded: false for the one page shown before onboarding.
const CASES: { name: string; onboarded?: boolean; post: (page: Page) => Promise<unknown> }[] = [
  { name: "brand colour", post: (page) => updateBrandingSettings(null, form(page, { expectedVersion: "1", brandColour: "#123456" })) },
  {
    name: "general settings",
    post: (page) => updateGeneralSettings(null, form(page, { expectedVersion: "1", shortCode: "BND", taxRegistered: "no" })),
  },
  { name: "logo", post: (page) => uploadLogo(null, form(page, { expectedVersion: "1", logo: png() })) },
  {
    name: "bank details",
    post: (page) =>
      saveBankDetails(null, form(page, { expectedVersion: "1", bankName: "Maybank", bankAccountHolder: "Studio", bankAccountNumber: "5140 1234" })),
  },
  { name: "payment QR", post: (page) => uploadPaymentQr(null, form(page, { expectedVersion: "1", qr: png() })) },
  { name: "step-up prompt", post: (page) => confirmStepUp(null, form(page, { code: "123456" })) },
  {
    name: "numbering",
    post: (page) => updateNumberingSettings(null, form(page, { expectedVersion: "1", pattern: "X-{SEQ:4}", resetRule: "never" })),
  },
  {
    name: "onboarding",
    onboarded: false,
    post: (page) => completeOnboarding(null, form(page, { expectedVersion: "1", country: "MY", taxRegistered: "no" })),
  },
  { name: "catalog create", post: (page) => createServiceAction(null, form(page, service)) },
  {
    name: "catalog update",
    post: (page) => updateServiceAction(null, form(page, { id: page.serviceId, expectedVersion: "1", ...service, name: "Renamed" })),
  },
  {
    name: "catalog archive",
    post: (page) => setServiceArchivedAction(null, form(page, { id: page.serviceId, expectedVersion: "1", archived: "true" })),
  },
  {
    name: "email template",
    post: (page) =>
      saveEmailTemplateAction(
        null,
        form(page, { event: "invoice_sent", expectedVersion: "0", intent: "save", subject: "Invoice {{invoice_number}}", body: "Hi {{client_name}}" }),
      ),
  },
  // Not a form of fields: the page binds the rendered workspace and an idempotency key into the action.
  { name: "test email", post: (page) => sendTestEmail({ workspaceId: page.workspaceId }, randomUUID()) },
];

const TENANT_TABLES = ["workspace_settings", "audit_log", "service", "email_template", "doc_sequence", "step_up", "notification", "idempotency_key"];

// Everything a post could change in the two workspaces, and the global rate-limit rows.
async function snapshot(workspaces: string[]) {
  const tables: Record<string, unknown[]> = {};
  for (const table of TENANT_TABLES) {
    tables[table] = [
      ...(await admin`select to_jsonb(t) as row from ${admin(table)} t where workspace_id = any(${workspaces}::uuid[]) order by to_jsonb(t)::text`),
    ];
  }
  const jobs = [...(await admin`select name, data from pgboss.job_common where data->>'workspaceId' = any(${workspaces}) order by id`)];
  const limits = [...(await admin`select key, count from rate_limit order by key`)];
  return { tables, jobs, limits, puts, authPosts: authPosts.mock.calls.length };
}

async function newWorkspace(ownerId: string, sessionId: string, onboarded: boolean): Promise<Page> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('binding', ${`binding-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  const country = onboarded ? "MY" : null;
  await admin`insert into workspace_settings (workspace_id, country, default_currency, timezone)
    values (${org.id}, ${country}, ${onboarded ? "MYR" : null}, ${onboarded ? "Asia/Kuala_Lumpur" : null})`;
  await admin`insert into member (organization_id, user_id, role, created_at) values (${org.id}, ${ownerId}, 'owner', now())`;
  // A fresh step-up in both, so step-up is never why a payment post is refused.
  await admin`insert into step_up (workspace_id, session_id, verified_at) values (${org.id}, ${sessionId}, now())`;
  const [row] = await admin<{ id: string }[]>`
    insert into service (workspace_id, name, currency, default_unit_price_minor, default_taxable)
    values (${org.id}, 'Existing', 'MYR', null, false) returning id`;
  if (!row) throw new Error("service not created");
  return { workspaceId: org.id, serviceId: row.id };
}

beforeAll(async () => {
  [database, minio] = await Promise.all([startDatabase(), startMinio()]);
  databaseUrl = database.appUrl;
  realStorage = createS3Adapter(minio.config);
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
});

beforeEach(() => {
  puts = 0;
  authPosts.mockClear();
});

afterAll(async () => {
  const boss = globalThis as typeof globalThis & { crmSendBoss?: Promise<{ stop(): Promise<void> }> };
  await (await boss.crmSendBoss?.catch(() => undefined))?.stop();
  boss.crmSendBoss = undefined;
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } }; crmLimiterDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  await cache.crmLimiterDb?.sql.end();
  cache.crmDb = undefined;
  cache.crmLimiterDb = undefined;
  await admin?.end();
  await Promise.all([database?.stop(), minio?.stop()]);
});

describe("every bound action refuses a page rendered for another workspace (WORKSPACE_CHANGED)", () => {
  it.each(CASES)("$name: a stale post changes nothing in either workspace; one from the active workspace's page is done there", async ({ onboarded, post }) => {
    const [user] = await admin<{ id: string }[]>`
      insert into "user" (name, email) values ('Owner', ${`owner-${randomUUID()}@example.test`}) returning id`;
    if (!user) throw new Error("user not created");
    const sessionId = randomUUID();
    const first = await newWorkspace(user.id, sessionId, onboarded ?? true);
    const second = await newWorkspace(user.id, sessionId, onboarded ?? true);
    const both = [first.workspaceId, second.workspaceId];
    signedIn = { userId: user.id, sessionId, workspaceId: second.workspaceId };

    const before = await snapshot(both);
    expect(await post(first)).toEqual({ ok: false, status: "WORKSPACE_CHANGED" });
    expect(await snapshot(both)).toEqual(before);

    const rows = async (workspaceId: string) => {
      const { tables, jobs } = await snapshot([workspaceId]);
      return { tables, jobs };
    };
    const [firstBefore, secondBefore] = [await rows(first.workspaceId), await rows(second.workspaceId)];
    // Onboarding redirects once done (redirectTo "/"); every other action returns its result.
    const done = await post(second).catch((error: unknown) => ({ redirected: (error as { digest?: string }).digest?.includes(";/;") }));
    expect(done).toEqual(expect.objectContaining(onboarded === false ? { redirected: true } : { ok: true, status: "DONE" }));
    expect(await rows(second.workspaceId)).not.toEqual(secondBefore);
    expect(await rows(first.workspaceId)).toEqual(firstBefore);
  });
});
