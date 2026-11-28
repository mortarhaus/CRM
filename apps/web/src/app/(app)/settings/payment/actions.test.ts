import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createS3Adapter, type StorageAdapter } from "@/adapters/storage";
import { startMinio, type TestMinio } from "@/test/minio";
import { startDatabase, type TestDatabase } from "@/test/postgres";
import { rendered } from "@/test/rendered";

// Phase 2 plan Tasks 14 and 15: bank details and the payment QR through action() on the real crm_app role and a real
// MinIO. Step-up is a step_up row for the signed-in session, as verifyStepUp writes it (its code check is tested
// against Better Auth in lib/auth/step-up.test.ts).
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; sessionId: string; workspaceId: string | null; twoFactor: boolean } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && {
      user: { id: signedIn.userId, twoFactorEnabled: signedIn.twoFactor },
      session: { id: signedIn.sessionId, activeOrganizationId: signedIn.workspaceId },
    },
}));
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

const actions = await import("./actions");
const confirmStepUp = rendered(actions.confirmStepUp, () => signedIn?.workspaceId ?? undefined);
const saveBankDetails = rendered(actions.saveBankDetails, () => signedIn?.workspaceId ?? undefined);
const uploadPaymentQr = rendered(actions.uploadPaymentQr, () => signedIn?.workspaceId ?? undefined);
const { stableJobId } = await import("@/jobs/enqueue");
const { GET } = await import("../../files/payment-qr/route");

let database: TestDatabase;
let minio: TestMinio;
let admin: postgres.Sql;
let workspaceId = "";

const PNG_A = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1]);
const PNG_B = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 2]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function createWorkspace(): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('bank', ${`bank-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  await admin`insert into workspace_settings (workspace_id, country) values (${org.id}, 'MY')`;
  return org.id;
}

async function addMember(role: string, workspace = workspaceId): Promise<string> {
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Member', ${`member-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  await admin`insert into member (organization_id, user_id, role, created_at) values (${workspace}, ${user.id}, ${role}, now())`;
  return user.id;
}

// Signs a new member in (2FA on unless twoFactor is false); with stepUp, this session passed a code check just now.
async function signInAs(role: string, options: { stepUp?: boolean; workspace?: string; twoFactor?: boolean } = {}): Promise<string> {
  const workspace = options.workspace ?? workspaceId;
  const userId = await addMember(role, workspace);
  const sessionId = randomUUID();
  signedIn = { userId, sessionId, workspaceId: workspace, twoFactor: options.twoFactor ?? true };
  if (options.stepUp) await admin`insert into step_up (workspace_id, session_id, verified_at) values (${workspace}, ${sessionId}, now())`;
  return userId;
}

async function settings(workspace = workspaceId) {
  const [row] = await admin<{ version: number; bank_account_number: string | null; duitnow_qr_key: string | null; bank_details_changed_at: Date | null }[]>`
    select version, bank_account_number, duitnow_qr_key, bank_details_changed_at from workspace_settings where workspace_id = ${workspace}`;
  if (!row) throw new Error("no settings row");
  return row;
}

const bankAudits = (workspace = workspaceId) => admin<{ actor_user_id: string; before: unknown; after: unknown }[]>`
  select actor_user_id, before, after from audit_log
  where workspace_id = ${workspace} and action = 'workspace_settings.bank_details_updated' order by created_at`;
// The owner email jobs (plan Task 16): one per Owner per change, data IDs only, id from the change and the Owner.
const emailJobs = (workspace = workspaceId) => admin<{ id: string; data: Record<string, string> }[]>`
  select id, data from pgboss.job_common
  where name = 'email.bank_details_changed' and data->>'workspaceId' = ${workspace} order by data->>'userId'`;
const notifications = (workspace = workspaceId) => admin<{ user_id: string; kind: string; target_type: string; target_id: string }[]>`
  select user_id, kind, target_type, target_id from notification where workspace_id = ${workspace} order by user_id`;

function bankForm(version: number, fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("expectedVersion", String(version));
  const values = { bankName: "Maybank", bankAccountHolder: "Studio Sdn Bhd", bankAccountNumber: "5140 1234 56789", bankSwiftCode: "mbbemykl", ...fields };
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function qrForm(version: number, bytes: Uint8Array<ArrayBuffer>, name = "qr.png", type = "image/png"): FormData {
  const form = new FormData();
  form.set("expectedVersion", String(version));
  form.set("qr", new File([bytes], name, { type }));
  return form;
}

beforeAll(async () => {
  [database, minio] = await Promise.all([startDatabase(), startMinio()]);
  databaseUrl = database.appUrl;
  realStorage = createS3Adapter(minio.config);
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
});

beforeEach(async () => {
  puts = 0;
  workspaceId = await createWorkspace();
});

afterAll(async () => {
  const boss = globalThis as typeof globalThis & { crmSendBoss?: Promise<{ stop(): Promise<void> }> };
  await (await boss.crmSendBoss?.catch(() => undefined))?.stop();
  boss.crmSendBoss = undefined;
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  cache.crmDb = undefined;
  await admin?.end();
  await Promise.all([database?.stop(), minio?.stop()]);
});

describe("saveBankDetails", () => {
  it("refuses STEP_UP_REQUIRED without a step-up of this session, and changes nothing", async () => {
    await signInAs("owner");
    const before = await settings();
    expect(await saveBankDetails(null, bankForm(before.version))).toEqual({ ok: false, status: "STEP_UP_REQUIRED" });
    expect(await settings()).toEqual(before);
    expect(await bankAudits()).toHaveLength(0);
    expect(await notifications()).toHaveLength(0);
    expect(await emailJobs()).toHaveLength(0);
  });

  it("refuses an Admin with FORBIDDEN, even after step-up (Owner only, spec line 798)", async () => {
    await signInAs("admin", { stepUp: true });
    const before = await settings();
    expect(await saveBankDetails(null, bankForm(before.version))).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(await settings()).toEqual(before);
  });

  it("saves, audits the account number as its last 4 only, stamps the change and notifies every Owner", async () => {
    const otherOwner = await addMember("owner");
    await addMember("admin");
    const actor = await signInAs("owner", { stepUp: true });
    const before = await settings();
    expect(await saveBankDetails(null, bankForm(before.version))).toEqual({ ok: true, status: "DONE", data: { version: before.version + 1 } });

    const after = await settings();
    expect(after.bank_account_number).toBe("5140 1234 56789");
    expect(after.bank_details_changed_at).not.toBeNull();
    const [audit, ...more] = await bankAudits();
    expect(more).toHaveLength(0);
    expect(audit).toMatchObject({
      actor_user_id: actor,
      // PII columns are "[pii]" on both sides, even when empty (as for the other settings audits).
      before: { bank_name: null, bank_account_holder: "[pii]", bank_account_number: null, bank_swift_code: null },
      after: { bank_name: "Maybank", bank_account_holder: "[pii]", bank_account_number: { last4: "6789" }, bank_swift_code: "MBBEMYKL" },
    });
    // Q26: no full number and no hash of it anywhere in the entry.
    const entry = JSON.stringify(audit);
    expect(entry).not.toContain("1234");
    expect(entry).not.toContain(createHash("sha256").update("5140 1234 56789").digest("hex"));

    const target = { kind: "bank_details_changed", target_type: "workspace_settings", target_id: workspaceId };
    expect(await notifications()).toEqual([actor, otherOwner].sort().map((user_id) => ({ user_id, ...target })));

    // One email job per Owner (not the Admin), in the same transaction; IDs only, the change is the audit entry.
    const [{ id: changeId } = { id: "" }] = await admin<{ id: string }[]>`
      select id from audit_log where workspace_id = ${workspaceId} and action = 'workspace_settings.bank_details_updated'`;
    const jobs = await emailJobs();
    expect(jobs).toEqual(
      [actor, otherOwner].sort().map((userId) => ({ id: stableJobId(changeId, userId), data: { workspaceId, changeId, userId } })),
    );
    expect(JSON.stringify(jobs)).not.toContain("1234");
  });

  // Spec "Authorization" (revision 13): the last 4 characters as saved, a short value whole, no hash, on both sides.
  // The mask counts code points as the input does, so a character outside the BMP is never split (Bob spec R32 P2:
  // half a surrogate pair is not valid jsonb, and the save failed). Synthetic values only.
  it.each([
    ["a value of 3 characters, whole", "123", { last4: "123" }],
    ["a value of exactly 4", "5678", { last4: "5678" }],
    ["non-digits among the last 4", "5140-1234-AB", { last4: "4-AB" }],
    ["a character outside the BMP at the split", "5140 1\u{1D7D7}345", { last4: "\u{1D7D7}345" }],
  ])("audits %s as last4, after it is saved and before the next change", async (_name, value, masked) => {
    await signInAs("owner", { stepUp: true });
    const { version } = await settings();
    expect((await saveBankDetails(null, bankForm(version, { bankAccountNumber: value }))).ok).toBe(true);
    expect((await saveBankDetails(null, bankForm(version + 1))).ok).toBe(true);
    const [saved, next, ...more] = await bankAudits();
    expect(more).toHaveLength(0);
    expect(saved?.after).toMatchObject({ bank_account_number: masked });
    expect(next?.before).toMatchObject({ bank_account_number: masked });
    expect(next?.after).toMatchObject({ bank_account_number: { last4: "6789" } });
  });

  it("writes nothing for a save that changes nothing", async () => {
    await signInAs("owner", { stepUp: true });
    const { version } = await settings();
    await saveBankDetails(null, bankForm(version));
    const saved = await settings();
    expect(await saveBankDetails(null, bankForm(saved.version))).toEqual({ ok: true, status: "DONE", data: { version: saved.version } });
    expect(await settings()).toEqual(saved);
    expect(await bankAudits()).toHaveLength(1);
    expect(await notifications()).toHaveLength(1);
    expect(await emailJobs()).toHaveLength(1);
  });

  it.each([
    ["no account number", { bankAccountNumber: "" }, "bankAccountNumber"],
    ["no bank name", { bankName: "  " }, "bankName"],
    ["no account holder", { bankAccountHolder: "" }, "bankAccountHolder"],
    ["a SWIFT code of 9 characters", { bankSwiftCode: "MBBEMYKL1" }, "bankSwiftCode"],
  ])("refuses %s as INVALID_INPUT", async (_name, fields, field) => {
    await signInAs("owner", { stepUp: true });
    const before = await settings();
    expect(await saveBankDetails(null, bankForm(before.version, fields))).toEqual({ ok: false, status: "INVALID_INPUT", fields: [field] });
    expect(await settings()).toEqual(before);
  });

  it("accepts an empty SWIFT code (optional, plan Q17)", async () => {
    await signInAs("owner", { stepUp: true });
    const { version } = await settings();
    expect((await saveBankDetails(null, bankForm(version, { bankSwiftCode: "" }))).ok).toBe(true);
  });
});

describe("uploadPaymentQr", () => {
  it("replacing the QR leaves the old file in place (spec line 1138 done-when), keyed by content", async () => {
    await signInAs("owner", { stepUp: true });
    const first = await settings();
    expect((await uploadPaymentQr(null, qrForm(first.version, PNG_A, "qr.svg", "image/svg+xml"))).ok).toBe(true);
    const keyA = `ws/${workspaceId}/duitnow/${sha256(PNG_A)}.png`;
    expect((await settings()).duitnow_qr_key).toBe(keyA);

    expect((await uploadPaymentQr(null, qrForm(first.version + 1, PNG_B))).ok).toBe(true);
    expect((await settings()).duitnow_qr_key).toBe(`ws/${workspaceId}/duitnow/${sha256(PNG_B)}.png`);
    expect(await realStorage.head(keyA)).toEqual({ contentType: "image/png", contentLength: PNG_A.length });

    const audits = await bankAudits();
    expect(audits.map((audit) => (audit.after as { duitnow_qr_key: string }).duitnow_qr_key)).toEqual([keyA, (await settings()).duitnow_qr_key]);
    expect(await notifications()).toHaveLength(2);
    expect(await emailJobs()).toHaveLength(2);
  });

  it("stores the same image once: uploading it again changes nothing", async () => {
    await signInAs("owner", { stepUp: true });
    const { version } = await settings();
    await uploadPaymentQr(null, qrForm(version, PNG_A));
    const saved = await settings();
    expect(await uploadPaymentQr(null, qrForm(saved.version, PNG_A))).toEqual({ ok: true, status: "DONE", data: { version: saved.version } });
    expect(await settings()).toEqual(saved);
    expect(await bankAudits()).toHaveLength(1);
  });

  it("refuses STEP_UP_REQUIRED before the file is read or stored", async () => {
    await signInAs("owner");
    const before = await settings();
    expect(await uploadPaymentQr(null, qrForm(before.version, PNG_A))).toEqual({ ok: false, status: "STEP_UP_REQUIRED" });
    expect(puts).toBe(0);
    expect(await settings()).toEqual(before);
  });

  it("refuses an Admin with FORBIDDEN, even after step-up, and stores nothing (changes stay Owner only)", async () => {
    await signInAs("admin", { stepUp: true });
    const before = await settings();
    expect(await uploadPaymentQr(null, qrForm(before.version, PNG_A))).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(puts).toBe(0);
    expect(await settings()).toEqual(before);
  });

  it("refuses an SVG named qr.png by its bytes, and stores nothing", async () => {
    await signInAs("owner", { stepUp: true });
    const before = await settings();
    expect(await uploadPaymentQr(null, qrForm(before.version, SVG))).toEqual({ ok: false, status: "UPLOAD_TYPE_NOT_ALLOWED" });
    expect(puts).toBe(0);
    expect(await settings()).toEqual(before);
  });
});

// The Bank QR preview, the scoped FILE-04 alternative (PROJECT.md §9; spec "Input, templates, files"): the handler is
// called directly, as the origin. The workspace's require_2fa is off throughout (the column's default).
describe("files/payment-qr", () => {
  const get = (query: string, init?: RequestInit) => GET(new Request(`http://localhost/files/payment-qr${query}`, init));

  // PNG_A, then PNG_B as the current QR, uploaded by an Owner.
  async function withTwoQrs(): Promise<void> {
    await signInAs("owner", { stepUp: true });
    const { version } = await settings();
    await uploadPaymentQr(null, qrForm(version, PNG_A));
    await uploadPaymentQr(null, qrForm(version + 1, PNG_B));
    const [row] = await admin<{ require_2fa: boolean }[]>`select require_2fa from workspace_settings where workspace_id = ${workspaceId}`;
    expect(row?.require_2fa).toBe(false);
  }

  // Points the signed-in session at another active workspace (or none), keeping the user and their memberships.
  function pointSessionAt(workspace: string | null): void {
    if (!signedIn) throw new Error("not signed in");
    signedIn = { ...signedIn, workspaceId: workspace };
  }

  // Every refusal is the same 404, never a cacheable image.
  async function expectRefused(response: Response): Promise<void> {
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBeNull();
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  }

  it.each(["owner", "admin"])("serves the current QR to an %s with 2FA and no step-up, with the exact headers", async (role) => {
    await withTwoQrs();
    await signInAs(role);
    const served = await get(`?id=${sha256(PNG_B)}`);
    expect(served.status).toBe(200);
    expect(Object.fromEntries(served.headers)).toEqual({
      "content-type": "image/png",
      "content-length": String(PNG_B.length),
      "content-disposition": "attachment",
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600, must-revalidate",
    });
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG_B);
  });

  it("refuses signed out, no active workspace, Staff, and an Admin or Owner without 2FA (require_2fa off)", async () => {
    await withTwoQrs();
    const current = `?id=${sha256(PNG_B)}`;
    signedIn = null;
    await expectRefused(await get(current));
    await signInAs("owner");
    pointSessionAt(null);
    await expectRefused(await get(current));
    await signInAs("staff");
    await expectRefused(await get(current));
    await signInAs("admin", { twoFactor: false });
    await expectRefused(await get(current));
    await signInAs("owner", { twoFactor: false, stepUp: true });
    await expectRefused(await get(current));
  });

  it("refuses another workspace's member, an old, unknown or malformed id; the workspace comes from the session only", async () => {
    await withTwoQrs();
    const own = workspaceId;
    const current = `?id=${sha256(PNG_B)}`;
    await signInAs("owner", { workspace: await createWorkspace() });
    await expectRefused(await get(current));
    // Naming this workspace in the request changes nothing (TEN-11).
    await expectRefused(await get(`${current}&workspaceId=${own}`, { headers: { "x-workspace-id": own } }));
    // A session pointed at this workspace without a membership of it is no better.
    pointSessionAt(own);
    await expectRefused(await get(current));

    await signInAs("owner");
    await expectRefused(await get(`?id=${sha256(PNG_A)}`));
    await expectRefused(await get(`?id=${sha256(SVG)}`));
    await expectRefused(await get("?id=../../x"));
    await expectRefused(await get(""));
    expect((await get(current)).status).toBe(200);
  });
});

describe("confirmStepUp", () => {
  it("reads the code from the posted form and refuses a malformed one before any check", async () => {
    await signInAs("owner");
    const form = new FormData();
    form.set("code", "12345");
    expect(await confirmStepUp(null, form)).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["code"] });
  });
});
