import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { DbHandle } from "../../db/client";
import * as schema from "../../db/schema";
import type { Tx } from "../../db/workspace";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import type { ActionContext, Json, Role } from "./action";
import { type Auth, createAuth } from "./config";

// Plan Task 14 Step 2: action() and requireWorkspaceMember() against a real Better Auth instance on the real
// crm_app role. The request's cookie comes from a stubbed next/headers; every database statement the code under
// test sends is recorded through the driver's debug hook, so the order of the steps is read from what really ran.
const PASSWORD = "correct horse battery staple 42";
const ORIGIN = "http://localhost:3000";

let requestHeaders = new Headers();
const steps: string[] = [];
let handle: DbHandle;

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("../../db/index", () => ({ getDb: () => handle }));
vi.mock("./server", () => ({ getAuth: () => auth }));
vi.mock("./session", async (importOriginal) => {
  const original = await importOriginal<typeof import("./session")>();
  return {
    ...original,
    getCurrentSession: async () => {
      steps.push("session");
      return original.getCurrentSession();
    },
  };
});

const { action, requireWorkspaceMember } = await import("./action");

let database: TestDatabase;
let admin: postgres.Sql;
let auth: Auth;
let queries: string[] = [];
let counter = 0;

interface Party {
  userId: string;
  cookie: string;
  workspaceId: string;
}

let owner: Party;
let other: Party;

// The step a statement belongs to, by the table it touches; statements of no step (Better Auth's session read,
// transaction control) are not recorded.
function stepOf(query: string): string | undefined {
  if (/from "member"/.test(query)) return "membership";
  if (/^\s*(insert into|delete from) idempotency_key/i.test(query)) return "idempotency";
  if (/^\s*update idempotency_key/i.test(query)) return "store";
  return undefined;
}

function recordQuery(query: string): void {
  queries.push(query);
  const step = stepOf(query);
  if (step !== undefined && steps.at(-1) !== step) steps.push(step);
}

async function signIn(email: string): Promise<string> {
  const response = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .join("; ");
}

async function newUser(label: string): Promise<{ userId: string; cookie: string }> {
  counter += 1;
  const email = `${label}-${counter}-${Date.now()}@example.test`;
  await auth.api.signUpEmail({ body: { name: `${label} user`, email, password: PASSWORD } });
  const cookie = await signIn(email);
  const [row] = await admin<{ id: string }[]>`select id from "user" where email = ${email}`;
  if (!row) throw new Error("user not created");
  return { userId: row.id, cookie };
}

// A user who created a workspace: Better Auth makes them its owner and the session's active workspace.
async function newParty(label: string): Promise<Party> {
  const { userId, cookie } = await newUser(label);
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/organization/create`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ name: `${label} studio`, slug: `${label}-${counter}-${Date.now()}` }),
    }),
  );
  expect(response.status).toBe(200);
  const { id } = (await response.json()) as { id: string };
  const [active] = await admin<{ id: string | null }[]>`
    select active_organization_id as id from session where user_id = ${userId}`;
  expect(active?.id).toBe(id);
  return { userId, cookie, workspaceId: id };
}

function signedInAs(cookie: string | null): void {
  requestHeaders = new Headers(cookie === null ? {} : { cookie });
}

function reset(): void {
  steps.length = 0;
  queries = [];
}

async function setRole(party: Party, role: string): Promise<void> {
  await admin`update member set "role" = ${role} where user_id = ${party.userId} and organization_id = ${party.workspaceId}`;
}

async function keyRows(workspaceId: string, key: string) {
  return admin<{ action: string; response: unknown }[]>`
    select action, response from idempotency_key where workspace_id = ${workspaceId} and key = ${key}`;
}

// A handler that records what it saw, including the workspace setting of the transaction it runs in.
function recordingHandler() {
  const seen: { workspaceId: string; userId: string; role: string; setting: string | null; input: unknown }[] = [];
  const handler = vi.fn(async (ctx: { tx: Tx; workspaceId: string; userId: string; role: string }, input: unknown) => {
    steps.push("handler");
    const [row] = await ctx.tx.execute<{ setting: string | null }>(
      sql`select current_setting('app.workspace_id', true) as setting`,
    );
    seen.push({ workspaceId: ctx.workspaceId, userId: ctx.userId, role: ctx.role, setting: row?.setting ?? null, input });
    return { done: true, n: seen.length };
  });
  return { handler, seen };
}

const noteInput = z.object({ note: z.string().min(1) });

// An action on noteInput; the handler decides what it does.
type NoteHandler = (ctx: ActionContext, input: { note: string }) => Promise<Json>;
function noteAction(name: string, minRole: Role, handler: NoteHandler, idempotent = false) {
  return action({ name, minRole, input: noteInput, idempotent, handler });
}

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  const debug = (_connection: number, query: string) => recordQuery(query);
  const client = postgres(database.appUrl, { max: 4, prepare: false, onnotice: () => {}, debug });
  handle = { sql: client, db: drizzle({ client, schema }) };
  auth = createAuth({ db: handle.db, secret: "integration test secret, not a real key", baseURL: ORIGIN });
  owner = await newParty("owner");
  other = await newParty("other");
});

afterAll(async () => {
  await handle?.sql.end();
  await admin?.end();
  await database?.stop();
});

beforeEach(async () => {
  await setRole(owner, "owner");
  await admin`update session set active_organization_id = ${owner.workspaceId} where user_id = ${owner.userId}`;
  signedInAs(owner.cookie);
  reset();
});

describe("action(): session", () => {
  it("returns UNAUTHENTICATED with no session, and touches neither Zod, the database nor the handler", async () => {
    signedInAs(null);
    const { handler } = recordingHandler();
    const input = z.object({ note: z.string() });
    const parse = vi.spyOn(input, "safeParse");
    const run = action({ name: "test.note", minRole: "staff", input, idempotent: true, handler });
    expect(await run({ note: "x" }, randomUUID())).toEqual({ ok: false, status: "UNAUTHENTICATED" });
    expect(handler).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    // Better Auth's own request transaction (Task 31) still runs for the session read; nothing past it does.
    expect(queries.filter((query) => /member|idempotency_key|workspace_settings|app\.workspace_id/.test(query))).toEqual([]);
    expect(steps).toEqual(["session"]);
  });

  it("returns NO_WORKSPACE for a session with no active workspace", async () => {
    const lone = await newUser("lone");
    signedInAs(lone.cookie);
    reset();
    const { handler } = recordingHandler();
    const run = noteAction("test.note", "staff", handler);
    expect(await run({ note: "x" })).toEqual({ ok: false, status: "NO_WORKSPACE" });
    expect(handler).not.toHaveBeenCalled();
    expect(steps).toEqual(["session"]);
  });
});

describe("action(): workspace and role", () => {
  it("takes the workspace from the session only: a workspaceId in the input is never used", async () => {
    const { handler, seen } = recordingHandler();
    const input = z.looseObject({ note: z.string() });
    const run = action({ name: "test.note", minRole: "staff", input, idempotent: false, handler });
    const result = await run({ note: "x", workspaceId: other.workspaceId });
    expect(result).toEqual({ ok: true, status: "DONE", data: { done: true, n: 1 } });
    expect(seen).toEqual([
      {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        role: "owner",
        setting: owner.workspaceId,
        input: { note: "x", workspaceId: other.workspaceId },
      },
    ]);
  });

  it("runs a staff-level action for an owner, and an admin-level one for an admin", async () => {
    const { handler, seen } = recordingHandler();
    expect((await noteAction("test.staff", "staff", handler)({ note: "x" })).ok).toBe(true);
    await setRole(owner, "admin");
    expect((await noteAction("test.admin", "admin", handler)({ note: "x" })).ok).toBe(true);
    expect(seen.map((entry) => entry.role)).toEqual(["owner", "admin"]);
  });

  it("returns FORBIDDEN for an owner-level action by a stored admin, and an admin-level one by staff", async () => {
    const { handler } = recordingHandler();
    await setRole(owner, "admin");
    expect(await noteAction("test.owner", "owner", handler)({ note: "x" })).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    await setRole(owner, "staff");
    expect(await noteAction("test.admin", "admin", handler)({ note: "x" })).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["member", "OWNER", ""])("returns FORBIDDEN for the unknown stored role %j", async (role) => {
    const { handler } = recordingHandler();
    await setRole(owner, role);
    expect(await noteAction("test.staff", "staff", handler)({ note: "x" })).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN for a stale active workspace (the user is not a member) before Zod runs", async () => {
    await admin`update session set active_organization_id = ${other.workspaceId} where user_id = ${owner.userId}`;
    const { handler } = recordingHandler();
    const input = z.object({ note: z.string() });
    const parse = vi.spyOn(input, "safeParse");
    const run = action({ name: "test.note", minRole: "staff", input, idempotent: true, handler });
    expect(await run({ note: "x" }, randomUUID())).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(parse).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(steps).toEqual(["session", "membership"]);
  });

  it("requireWorkspaceMember() returns the user, the session's workspace and the stored role", async () => {
    const member = await requireWorkspaceMember("admin");
    expect(member).toEqual({ userId: owner.userId, workspaceId: owner.workspaceId, role: "owner" });
    await setRole(owner, "staff");
    await expect(requireWorkspaceMember("admin")).rejects.toMatchObject({ status: "FORBIDDEN" });
  });

  it("requireWorkspaceMember() heals a missing workspace_settings row", async () => {
    await admin`delete from workspace_settings where workspace_id = ${owner.workspaceId}`;
    await requireWorkspaceMember("staff");
    const rows = await admin`select workspace_id from workspace_settings where workspace_id = ${owner.workspaceId}`;
    expect(rows).toEqual([{ workspace_id: owner.workspaceId }]);
  });
});

describe("action(): input", () => {
  it("returns INVALID_INPUT with the field paths and no values, and does not call the handler", async () => {
    const { handler } = recordingHandler();
    const input = z.object({ note: z.string().min(1), amount: z.number().int(), nested: z.object({ email: z.email() }) });
    const run = action({ name: "test.input", minRole: "staff", input, idempotent: false, handler });
    const result = await run({ note: "", amount: 1.5, nested: { email: "secret value not an email" } });
    expect(result).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["note", "amount", "nested.email"] });
    expect(JSON.stringify(result)).not.toContain("secret value");
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["too long", "k".repeat(129)],
  ])("returns INVALID_INPUT on idempotencyKey for an idempotent action with a %s key", async (_label, key) => {
    const { handler } = recordingHandler();
    const run = noteAction("test.key", "staff", handler, true);
    expect(await run({ note: "x" }, key)).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["idempotencyKey"] });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("action(): idempotency", () => {
  it("runs the handler once for the same key and input, and replays the stored response", async () => {
    const { handler } = recordingHandler();
    const run = noteAction("test.replay", "staff", handler, true);
    const key = randomUUID();
    expect(await run({ note: "x" }, key)).toEqual({ ok: true, status: "DONE", data: { done: true, n: 1 } });
    expect(await run({ note: "x" }, key)).toEqual({ ok: true, status: "REPLAYED", data: { done: true, n: 1 } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await keyRows(owner.workspaceId, key)).toEqual([{ action: "test.replay", response: { done: true, n: 1 } }]);
  });

  it("treats input that differs only in key order as the same request", async () => {
    const { handler } = recordingHandler();
    // A record keeps the submitted key order through Zod, so only the canonical hash makes these equal.
    const input = z.object({ tags: z.record(z.string(), z.record(z.string(), z.number())) });
    const run = action({ name: "test.order", minRole: "staff", input, idempotent: true, handler });
    const key = randomUUID();
    expect((await run({ tags: { a: { c: 1, d: 2 }, b: { e: 3 } } }, key)).status).toBe("DONE");
    expect((await run({ tags: { b: { e: 3 }, a: { d: 2, c: 1 } } }, key)).status).toBe("REPLAYED");
    expect((await run({ tags: { a: { c: 1, d: 3 }, b: { e: 3 } } }, key)).status).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("refuses to hash a Set, a Map, a Blob, a File or a class instance (TypeError), and claims no key", async () => {
    class Point {
      constructor(readonly x: number) {}
    }
    const values: [string, unknown][] = [
      ["Set", new Set([1])],
      ["Map", new Map([["a", 1]])],
      ["Blob", new Blob(["a"])],
      ["File", new File(["a"], "a.txt")],
      ["class instance", new Point(1)],
    ];
    for (const [label, value] of values) {
      const { handler } = recordingHandler();
      const input = z.object({ field: z.custom<unknown>(() => true) });
      const run = action({ name: `test.unhashable.${label}`, minRole: "staff", input, idempotent: true, handler });
      const key = randomUUID();
      await expect(run({ field: value }, key), label).rejects.toThrow(TypeError);
      expect(handler, label).not.toHaveBeenCalled();
      expect(await keyRows(owner.workspaceId, key), label).toEqual([]);
    }
    // An object with no prototype is plain: hashed by its entries like an object literal.
    const { handler } = recordingHandler();
    const input = z.object({ field: z.custom<unknown>(() => true) });
    const run = action({ name: "test.unhashable.null-prototype", minRole: "staff", input, idempotent: true, handler });
    const key = randomUUID();
    expect((await run({ field: Object.assign(Object.create(null), { a: 1 }) }, key)).status).toBe("DONE");
    expect((await run({ field: { a: 1 } }, key)).status).toBe("REPLAYED");
  });

  it("returns IDEMPOTENCY_KEY_REUSED for the same key with other input, or for another action", async () => {
    const { handler } = recordingHandler();
    const run = noteAction("test.reuse", "staff", handler, true);
    const key = randomUUID();
    await run({ note: "x" }, key);
    expect(await run({ note: "y" }, key)).toEqual({ ok: false, status: "IDEMPOTENCY_KEY_REUSED" });
    const otherAction = noteAction("test.other", "staff", handler, true);
    expect(await otherAction({ note: "x" }, key)).toEqual({ ok: false, status: "IDEMPOTENCY_KEY_REUSED" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("keeps keys per workspace: the same key in another workspace is a new request", async () => {
    const { handler } = recordingHandler();
    const run = noteAction("test.scope", "staff", handler, true);
    const key = randomUUID();
    expect((await run({ note: "x" }, key)).status).toBe("DONE");
    signedInAs(other.cookie);
    expect((await run({ note: "x" }, key)).status).toBe("DONE");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("leaves no idempotency_key row when the handler throws, so the key can be used again", async () => {
    const failing = vi.fn(async () => {
      throw new Error("handler failed");
    });
    const key = randomUUID();
    await expect(noteAction("test.fail", "staff", failing, true)({ note: "x" }, key)).rejects.toThrow(
      "handler failed",
    );
    expect(await keyRows(owner.workspaceId, key)).toEqual([]);
    const { handler } = recordingHandler();
    expect((await noteAction("test.fail", "staff", handler, true)({ note: "x" }, key)).status).toBe("DONE");
  });

  it("reclaims an expired key as a new request", async () => {
    const { handler } = recordingHandler();
    const run = noteAction("test.expiry", "staff", handler, true);
    const key = randomUUID();
    await run({ note: "x" }, key);
    await admin`update idempotency_key set expires_at = now() - interval '1 second' where key = ${key}`;
    expect(await run({ note: "y" }, key)).toEqual({ ok: true, status: "DONE", data: { done: true, n: 2 } });
    expect(await keyRows(owner.workspaceId, key)).toEqual([{ action: "test.expiry", response: { done: true, n: 2 } }]);
  });

  it("stores the key with the expiry from IDEMPOTENCY_KEY_EXPIRY_SECONDS", async () => {
    const { handler } = recordingHandler();
    const key = randomUUID();
    await noteAction("test.ttl", "staff", handler, true)({ note: "x" }, key);
    const [row] = await admin<{ seconds: number }[]>`
      select round(extract(epoch from expires_at - created_at))::int as seconds from idempotency_key where key = ${key}`;
    expect(row?.seconds).toBe(24 * 60 * 60);
  });

  it("ignores the key of an action that is not idempotent and stores nothing", async () => {
    const { handler } = recordingHandler();
    const key = randomUUID();
    const run = noteAction("test.plain", "staff", handler);
    expect((await run({ note: "x" }, key)).status).toBe("DONE");
    expect((await run({ note: "x" }, key)).status).toBe("DONE");
    expect(handler).toHaveBeenCalledTimes(2);
    expect(await keyRows(owner.workspaceId, key)).toEqual([]);
  });
});

describe("action(): order", () => {
  it("runs session, membership, Zod, idempotency, handler and store, in exactly that order", async () => {
    const { handler } = recordingHandler();
    const input = z.object({ note: z.string() });
    const parse = input.safeParse.bind(input);
    vi.spyOn(input, "safeParse").mockImplementation((value) => {
      steps.push("zod");
      return parse(value);
    });
    const run = action({ name: "test.order", minRole: "staff", input, idempotent: true, handler });
    expect((await run({ note: "x" }, randomUUID())).status).toBe("DONE");
    expect(steps).toEqual(["session", "membership", "zod", "idempotency", "handler", "store"]);
  });
});
