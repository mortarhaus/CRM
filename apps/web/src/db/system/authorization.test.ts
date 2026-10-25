import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuth, INVITATION_PATHS, type Auth } from "../../lib/auth/config";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { createDb, type DbHandle } from "../client";
import { billingAccount, member, organization, session, twoFactor, user, workspaceSettings } from "../schema";
import { runInWorkspace } from "../workspace";
import { getMembership } from "./workspaces";

// Plan Task 10: every system-module read and mutation of Phase 1, for two users in two workspaces. U1 is a
// member of W1 only and U2 of W2 only. The Better Auth endpoints are called over HTTP (auth.handler), the
// way a browser reaches them, with the real configuration, as crm_app.
const PASSWORD = "correct horse battery staple 42";
const ORIGIN = "http://localhost:3000";

interface Reply {
  status: number;
  json: unknown;
}

interface Party {
  userId: string;
  headers: Headers;
  workspaceId: string;
}

let database: TestDatabase;
let handle: DbHandle;
let admin: postgres.Sql;
let auth: Auth;
let counter = 0;
let u1: Party;
let u2: Party;

async function http(method: "GET" | "POST", path: string, body?: unknown, headers?: Headers): Promise<Reply> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("origin", ORIGIN);
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function signIn(email: string): Promise<Headers> {
  const response = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .join("; ");
  return new Headers({ cookie });
}

async function newParty(label: string): Promise<Party> {
  counter += 1;
  const email = `${label}-${counter}-${Date.now()}@example.test`;
  await auth.api.signUpEmail({ body: { name: `${label} user`, email, password: PASSWORD } });
  const headers = await signIn(email);
  const created = await http("POST", "/organization/create", { name: `${label} studio`, slug: `${label}-${counter}-${Date.now()}` }, headers);
  expect(created.status).toBe(200);
  const [row] = await handle.db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!row) throw new Error("user not created");
  return { userId: row.id, headers, workspaceId: (created.json as { id: string }).id };
}

async function sessionsOf(userId: string) {
  return handle.db.select().from(session).where(eq(session.userId, userId));
}

async function workspaceRow(workspaceId: string) {
  const [row] = await handle.db.select().from(organization).where(eq(organization.id, workspaceId));
  return row;
}

// Everything of U2's that a U1 request could reach: their user, sessions, 2FA, membership, workspace, billing.
async function snapshotOf(party: Party) {
  const [settings] = await admin`select * from workspace_settings where workspace_id = ${party.workspaceId}`;
  return {
    user: await handle.db.select().from(user).where(eq(user.id, party.userId)),
    sessions: await sessionsOf(party.userId),
    twoFactor: await handle.db.select().from(twoFactor).where(eq(twoFactor.userId, party.userId)),
    members: await handle.db.select().from(member).where(eq(member.organizationId, party.workspaceId)),
    workspace: await workspaceRow(party.workspaceId),
    billing: await handle.db.select().from(billingAccount).where(eq(billingAccount.ownerUserId, party.userId)),
    settings,
  };
}

async function makeStale(party: Party, workspaceId: string): Promise<void> {
  await admin`update session set active_organization_id = ${workspaceId} where user_id = ${party.userId}`;
}

beforeAll(async () => {
  database = await startDatabase();
  handle = createDb(database.appUrl);
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  auth = createAuth({ db: handle.db, secret: "integration test secret, not a real key", baseURL: ORIGIN });
});

afterAll(async () => {
  await admin?.end();
  await handle?.sql.end();
  await database?.stop();
});

beforeEach(async () => {
  u1 = await newParty("u1");
  u2 = await newParty("u2");
});

describe("getMembership", () => {
  it("returns the stored role of a member and null for a workspace the user is not in", async () => {
    expect(await getMembership(handle.db, u1.userId, u1.workspaceId)).toEqual({ role: "owner" });
    expect(await getMembership(handle.db, u1.userId, u2.workspaceId)).toBeNull();
    expect(await getMembership(handle.db, u2.userId, u1.workspaceId)).toBeNull();
  });

  it("returns null for a stale active workspace: membership is read from member, never from the session", async () => {
    await makeStale(u1, u2.workspaceId);
    const [stale] = await sessionsOf(u1.userId);
    expect(stale?.activeOrganizationId).toBe(u2.workspaceId);
    expect(await getMembership(handle.db, u1.userId, u2.workspaceId)).toBeNull();
  });

  it.each(["member", "superuser", "owner,admin", "", "OWNER"])("returns null for the stored role %j", async (role) => {
    await admin`update member set "role" = ${role} where user_id = ${u1.userId} and organization_id = ${u1.workspaceId}`;
    expect(await getMembership(handle.db, u1.userId, u1.workspaceId)).toBeNull();
  });

  it.each(["admin", "staff"])("returns the stored role %s", async (role) => {
    await admin`update member set "role" = ${role} where user_id = ${u1.userId} and organization_id = ${u1.workspaceId}`;
    expect(await getMembership(handle.db, u1.userId, u1.workspaceId)).toEqual({ role });
  });

  it("returns null for two member rows of one user in one workspace", async () => {
    await admin`insert into member (organization_id, user_id, role, created_at) values (${u1.workspaceId}, ${u1.userId}, 'owner', now())`;
    expect(await getMembership(handle.db, u1.userId, u1.workspaceId)).toBeNull();
  });

  it.each(["not-a-uuid", "", "' or 1=1 --"])("returns null for the workspace id %j without querying", async (id) => {
    expect(await getMembership(handle.db, u1.userId, id)).toBeNull();
  });

  it("returns null for an unknown workspace and an unknown user", async () => {
    expect(await getMembership(handle.db, u1.userId, randomUUID())).toBeNull();
    expect(await getMembership(handle.db, randomUUID(), u1.workspaceId)).toBeNull();
  });
});

describe("Better Auth endpoints: U1 cannot read or change W2", () => {
  // Better Auth 1.7.6 also clears the active workspace on a refused set-active (crud-org.mjs, checkMembership).
  it("/organization/set-active refuses W2 by id and never makes it active", async () => {
    expect((await http("POST", "/organization/set-active", { organizationId: u2.workspaceId }, u1.headers)).status).toBe(403);
    expect((await sessionsOf(u1.userId)).map((row) => row.activeOrganizationId)).toEqual([null]);
  });

  it("/organization/set-active with a stale active workspace refuses and clears it", async () => {
    await makeStale(u1, u2.workspaceId);
    expect((await http("POST", "/organization/set-active", {}, u1.headers)).status).toBe(403);
    expect((await sessionsOf(u1.userId)).map((row) => row.activeOrganizationId)).toEqual([null]);
  });

  it("/organization/update refuses W2 by id and with a stale active workspace; W2 is unchanged", async () => {
    const before = await snapshotOf(u2);
    const byId = await http("POST", "/organization/update", { organizationId: u2.workspaceId, data: { name: "Taken" } }, u1.headers);
    expect(byId.status).toBeGreaterThanOrEqual(400);
    await makeStale(u1, u2.workspaceId);
    const stale = await http("POST", "/organization/update", { data: { name: "Taken" } }, u1.headers);
    expect(stale.status).toBeGreaterThanOrEqual(400);
    expect(await snapshotOf(u2)).toEqual(before);
  });

  it("/organization/get-full-organization refuses W2 by id and with a stale active workspace", async () => {
    const byId = await http("GET", `/organization/get-full-organization?organizationId=${u2.workspaceId}`, undefined, u1.headers);
    expect(byId.status).toBe(403);
    await makeStale(u1, u2.workspaceId);
    expect((await http("GET", "/organization/get-full-organization", undefined, u1.headers)).status).toBe(403);
  });

  it("/organization/list lists W1 only", async () => {
    const reply = await http("GET", "/organization/list", undefined, u1.headers);
    expect(reply.status).toBe(200);
    expect((reply.json as { id: string }[]).map((row) => row.id)).toEqual([u1.workspaceId]);
  });

  it("/organization/create ignores a userId in the body: the creator owns the workspace and pays for it", async () => {
    const before = await snapshotOf(u2);
    const created = await http(
      "POST",
      "/organization/create",
      { name: "Not U2's", slug: `not-u2-${Date.now()}`, userId: u2.userId },
      u1.headers,
    );
    expect(created.status).toBe(200);
    const workspaceId = (created.json as { id: string }).id;
    const members = await handle.db.select().from(member).where(eq(member.organizationId, workspaceId));
    expect(members.map((row) => [row.userId, row.role])).toEqual([[u1.userId, "owner"]]);
    const [u1Billing] = await handle.db.select().from(billingAccount).where(eq(billingAccount.ownerUserId, u1.userId));
    expect((await workspaceRow(workspaceId))?.billingAccountId).toBe(u1Billing?.id);
    const [settings] = await admin`select version from workspace_settings where workspace_id = ${workspaceId}`;
    expect(settings).toEqual({ version: 1 });
    expect(await snapshotOf(u2)).toEqual(before);
  });

  it("/get-session and /list-sessions show U1's own sessions only", async () => {
    const own = await http("GET", "/get-session", undefined, u1.headers);
    expect((own.json as { user: { id: string } }).user.id).toBe(u1.userId);
    const listed = await http("GET", "/list-sessions", undefined, u1.headers);
    expect(listed.status).toBe(200);
    const rows = listed.json as { id: string; userId: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.userId === u1.userId)).toBe(true);
    const u2Ids = (await sessionsOf(u2.userId)).map((row) => row.id);
    expect(rows.map((row) => row.id).filter((id) => u2Ids.includes(id))).toEqual([]);
  });

  it("/revoke-session cannot end U2's session by its token or by its id", async () => {
    const [target] = await sessionsOf(u2.userId);
    if (!target) throw new Error("U2 has no session");
    await http("POST", "/revoke-session", { token: target.token }, u1.headers);
    await http("POST", "/revoke-session", { token: target.id }, u1.headers);
    expect(await sessionsOf(u2.userId)).toEqual([target]);
    const still = await http("GET", "/get-session", undefined, u2.headers);
    expect((still.json as { user: { id: string } }).user.id).toBe(u2.userId);
  });

  it("/update-user changes only the signed-in user, whatever ids the body names", async () => {
    const before = await snapshotOf(u2);
    await http("POST", "/update-user", { name: "Renamed", id: u2.userId, userId: u2.userId }, u1.headers);
    expect(await snapshotOf(u2)).toEqual(before);
  });

  it("/two-factor/* act on the signed-in user only, whatever ids the body names", async () => {
    const enrolled = await http("POST", "/two-factor/enable", { password: PASSWORD }, u2.headers);
    expect(enrolled.status).toBe(200);
    const before = await snapshotOf(u2);
    expect(before.twoFactor).toHaveLength(1);
    const target = { userId: u2.userId, id: u2.userId };
    for (const path of ["/two-factor/enable", "/two-factor/get-totp-uri", "/two-factor/generate-backup-codes", "/two-factor/disable"]) {
      const reply = await http("POST", path, { password: PASSWORD, ...target }, u1.headers);
      const totpURI = (reply.json as { totpURI?: string } | null)?.totpURI;
      if (totpURI) expect(totpURI).not.toBe((enrolled.json as { totpURI: string }).totpURI);
    }
    expect(await snapshotOf(u2)).toEqual(before);
  });
});

describe("system-module writes stay in their own workspace", () => {
  it("creating a workspace touches no other workspace's settings, members or billing account", async () => {
    const before = await snapshotOf(u2);
    const created = await http("POST", "/organization/create", { name: "Third", slug: `third-${Date.now()}` }, u1.headers);
    expect(created.status).toBe(200);
    expect(await snapshotOf(u2)).toEqual(before);
    const u1Accounts = await handle.db.select().from(billingAccount).where(eq(billingAccount.ownerUserId, u1.userId));
    expect(u1Accounts).toHaveLength(1);
    const rows = await admin`select workspace_id from workspace_settings where workspace_id in ${admin([u1.workspaceId, u2.workspaceId, (created.json as { id: string }).id])}`;
    expect(rows).toHaveLength(3);
  });

  it("workspace_settings is invisible across workspaces to crm_app (RLS), and the system module writes only the one it names", async () => {
    const seen = await runInWorkspace(handle.db, u1.workspaceId, (tx) => tx.select().from(workspaceSettings));
    expect(seen.map((row) => row.workspaceId)).toEqual([u1.workspaceId]);
    const visible = await runInWorkspace(handle.db, u1.workspaceId, (tx) =>
      tx.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, u2.workspaceId)),
    );
    expect(visible).toEqual([]);
  });
});

describe("invitation endpoints are disabled in Phase 1 (plan Tasks 10 and 24)", () => {
  const anyId = randomUUID();

  it.each([
    ["POST", "/organization/invite-member", { email: "someone@example.test", role: "member" }],
    ["POST", "/organization/accept-invitation", { invitationId: anyId }],
    ["POST", "/organization/reject-invitation", { invitationId: anyId }],
    ["POST", "/organization/cancel-invitation", { invitationId: anyId }],
    ["GET", `/organization/get-invitation?id=${anyId}`, undefined],
    ["GET", "/organization/list-invitations", undefined],
    ["GET", "/organization/list-user-invitations", undefined],
  ] as const)("%s %s answers 404, signed in or not", async (method, path, body) => {
    expect((await http(method, path, body, u1.headers)).status).toBe(404);
    expect((await http(method, path, body)).status).toBe(404);
  });

  it("disables every invitation endpoint the installed Better Auth exposes", () => {
    const exposed = Object.values(auth.api)
      .map((endpoint) => (endpoint as { path?: string }).path)
      .filter((path): path is string => typeof path === "string" && /invit/i.test(path));
    expect(exposed.length).toBeGreaterThan(0);
    expect([...exposed].sort()).toEqual([...INVITATION_PATHS].sort());
  });
});
