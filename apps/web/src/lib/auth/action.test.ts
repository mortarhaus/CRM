import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createDb, type DbHandle } from "../../db/client";
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
let limiter: DbHandle;

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

const { ActionRefusedError, action, requireWorkspaceMember } = await import("./action");

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

// The workspace the "page" a test posts from was rendered for: the signed-in party's active one unless a test says
// otherwise. b() adds it to an input, as a page that binds an action's input does.
let active = "";
const b = <T extends object>(input: T) => ({ workspaceId: active, ...input });

function signedInAs(cookie: string | null, workspaceId = owner.workspaceId): void {
  requestHeaders = new Headers(cookie === null ? {} : { cookie });
  active = workspaceId;
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
  limiter = createDb(database.appUrl, { max: 2 });
  auth = createAuth({ db: handle.db, limiterDb: limiter.db, secret: "integration test secret, not a real key", baseURL: ORIGIN });
  owner = await newParty("owner");
  other = await newParty("other");
});

afterAll(async () => {
  await handle?.sql.end();
  await limiter?.sql.end();
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
    expect(await run(b({ note: "x" }), randomUUID())).toEqual({ ok: false, status: "UNAUTHENTICATED" });
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
    expect(await run(b({ note: "x" }))).toEqual({ ok: false, status: "NO_WORKSPACE" });
    expect(handler).not.toHaveBeenCalled();
    expect(steps).toEqual(["session"]);
  });
});

describe("action(): workspace and role", () => {
  it("takes the workspace from the session only: the posted workspaceId is compared, never used, and Zod never sees it", async () => {
    const { handler, seen } = recordingHandler();
    const input = z.strictObject({ note: z.string() });
    const run = action({ name: "test.note", minRole: "staff", input, idempotent: false, handler });
    expect(await run({ note: "x", workspaceId: owner.workspaceId })).toEqual({ ok: true, status: "DONE", data: { done: true, n: 1 } });
    expect(seen).toEqual([{ workspaceId: owner.workspaceId, userId: owner.userId, role: "owner", setting: owner.workspaceId, input: { note: "x" } }]);
  });

  it("runs a staff-level action for an owner, and an admin-level one for an admin", async () => {
    const { handler, seen } = recordingHandler();
    expect((await noteAction("test.staff", "staff", handler)(b({ note: "x" }))).ok).toBe(true);
    await setRole(owner, "admin");
    expect((await noteAction("test.admin", "admin", handler)(b({ note: "x" }))).ok).toBe(true);
    expect(seen.map((entry) => entry.role)).toEqual(["owner", "admin"]);
  });

  it("returns FORBIDDEN for an owner-level action by a stored admin, and an admin-level one by staff", async () => {
    const { handler } = recordingHandler();
    await setRole(owner, "admin");
    expect(await noteAction("test.owner", "owner", handler)(b({ note: "x" }))).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    await setRole(owner, "staff");
    expect(await noteAction("test.admin", "admin", handler)(b({ note: "x" }))).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["member", "OWNER", ""])("returns FORBIDDEN for the unknown stored role %j", async (role) => {
    const { handler } = recordingHandler();
    await setRole(owner, role);
    expect(await noteAction("test.staff", "staff", handler)(b({ note: "x" }))).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN for a stale active workspace (the user is not a member) before Zod runs", async () => {
    await admin`update session set active_organization_id = ${other.workspaceId} where user_id = ${owner.userId}`;
    active = other.workspaceId;
    const { handler } = recordingHandler();
    const input = z.object({ note: z.string() });
    const parse = vi.spyOn(input, "safeParse");
    const run = action({ name: "test.note", minRole: "staff", input, idempotent: true, handler });
    expect(await run(b({ note: "x" }), randomUUID())).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(parse).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(steps).toEqual(["session", "membership"]);
  });

  it("requireWorkspaceMember() returns the user, the session, the session's workspace and the stored role", async () => {
    const member = await requireWorkspaceMember("admin");
    const [current] = await admin<{ id: string }[]>`select id from session where user_id = ${owner.userId}`;
    expect(member).toEqual({
      userId: owner.userId,
      sessionId: current?.id,
      twoFactorEnabled: false,
      workspaceId: owner.workspaceId,
      role: "owner",
    });
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

// PR 76 Review R1 P0, made shared (DECISIONS 2026-11-25): a page rendered for workspace A, posted after the session
// switched to B. Every action() is bound; there is no opt-out.
describe("action(): the workspace the posting page was rendered for", () => {
  const spied = () => {
    const input = z.object({ note: z.string() });
    const parse = vi.spyOn(input, "safeParse");
    const before = vi.fn(async () => {});
    return { input, parse, before };
  };

  it.each([
    ["another workspace", () => ({ workspaceId: other.workspaceId })],
    ["no workspace", () => ({})],
    ["a workspace that is not text", () => ({ workspaceId: 42 })],
  ])("refuses an input naming %s with WORKSPACE_CHANGED before membership, Zod, beforeTransaction or a key", async (_label, extra) => {
    const { handler } = recordingHandler();
    const { input, parse, before } = spied();
    const run = action({ name: "test.bound", minRole: "staff", input, idempotent: true, handler, beforeTransaction: before });
    const key = randomUUID();
    expect(await run({ note: "x", ...extra() }, key)).toEqual({ ok: false, status: "WORKSPACE_CHANGED" });
    expect(steps).toEqual(["session"]);
    expect(queries.filter((query) => /member|idempotency_key|workspace_settings|app\.workspace_id/.test(query))).toEqual([]);
    expect(parse).not.toHaveBeenCalled();
    expect(before).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(await keyRows(owner.workspaceId, key)).toEqual([]);
  });

  it("refuses a form posted from another workspace's page, or one with no such field, and never echoes it", async () => {
    const { handler } = recordingHandler();
    const { input, parse } = spied();
    const fromForm = (form: FormData) => ({ note: form.get("note") });
    const echo = (form: FormData) => ({ shown: String(form.get("note")) });
    const run = action({ name: "test.bound.form", minRole: "staff", input, idempotent: false, handler, fromForm, echo });
    for (const workspaceId of [other.workspaceId, null]) {
      const form = new FormData();
      if (workspaceId !== null) form.append("workspaceId", workspaceId);
      form.append("note", "typed in the other workspace");
      // The previous state (the first argument) is never read for the binding: only the form is.
      expect(await run({ workspaceId: owner.workspaceId }, form)).toEqual({ ok: false, status: "WORKSPACE_CHANGED" });
    }
    expect(parse).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("acts in the session's workspace after a switch, for a page rendered there", async () => {
    await admin`insert into member (organization_id, user_id, role, created_at) values (${other.workspaceId}, ${owner.userId}, 'admin', now())`;
    await admin`update session set active_organization_id = ${other.workspaceId} where user_id = ${owner.userId}`;
    const { handler, seen } = recordingHandler();
    const run = noteAction("test.bound.switched", "staff", handler);
    expect(await run({ note: "x", workspaceId: owner.workspaceId })).toEqual({ ok: false, status: "WORKSPACE_CHANGED" });
    expect(await run({ note: "x", workspaceId: other.workspaceId })).toMatchObject({ ok: true, status: "DONE" });
    expect(seen.map(({ workspaceId, setting, role }) => ({ workspaceId, setting, role }))).toEqual([
      { workspaceId: other.workspaceId, setting: other.workspaceId, role: "admin" },
    ]);
    await admin`delete from member where organization_id = ${other.workspaceId} and user_id = ${owner.userId}`;
  });

  it("leaves requireWorkspaceMember() unbound for a page, which reads the session's workspace", async () => {
    expect((await requireWorkspaceMember("staff")).workspaceId).toBe(owner.workspaceId);
    await expect(requireWorkspaceMember("staff", other.workspaceId)).rejects.toMatchObject({ status: "WORKSPACE_CHANGED" });
    await expect(requireWorkspaceMember("staff", null)).rejects.toMatchObject({ status: "WORKSPACE_CHANGED" });
  });
});

describe("action(): input", () => {
  it("returns INVALID_INPUT with the field paths and no values, and does not call the handler", async () => {
    const { handler } = recordingHandler();
    const input = z.object({ note: z.string().min(1), amount: z.number().int(), nested: z.object({ email: z.email() }) });
    const run = action({ name: "test.input", minRole: "staff", input, idempotent: false, handler });
    const result = await run(b({ note: "", amount: 1.5, nested: { email: "secret value not an email" } }));
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
    expect(await run(b({ note: "x" }), key)).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["idempotencyKey"] });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("action(): a form posted through useActionState, called as (previous state, form data)", () => {
  const noteForm = (note: string) => {
    const form = new FormData();
    form.append("workspaceId", active);
    form.append("note", note);
    return form;
  };

  it("validates what fromForm picks from the form, never the previous state", async () => {
    const { handler, seen } = recordingHandler();
    const fromForm = (form: FormData) => ({ note: form.get("note") });
    const run = action({ name: "test.form", minRole: "staff", input: noteInput, idempotent: false, handler, fromForm });
    expect(await run(b({ note: "previous state" }), noteForm("from the form"))).toMatchObject({ ok: true, status: "DONE" });
    expect(seen.map(({ input }) => input)).toEqual([{ note: "from the form" }]);
    expect(await run(null, noteForm(""))).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["note"] });
  });

  it("sends back what echo picks from a refused form, and nothing for a valid one or an input that is not a form", async () => {
    const { handler } = recordingHandler();
    const fromForm = (form: FormData) => ({ note: form.get("note") });
    const echo = (form: FormData) => ({ shown: String(form.get("note")) });
    const run = action({ name: "test.echo", minRole: "staff", input: noteInput, idempotent: false, handler, fromForm, echo });
    expect(await run(null, noteForm(""))).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["note"], echo: { shown: "" } });
    expect(await run(b({ note: "" }))).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["note"] });
    expect(await run(null, noteForm("fine"))).toEqual({ ok: true, status: "DONE", data: { done: true, n: 1 } });
  });

  it("an action without fromForm takes only its first argument, and a form is never an idempotency key", async () => {
    const { handler, seen } = recordingHandler();
    const run = noteAction("test.no-form", "staff", handler);
    expect(await run(b({ note: "first argument" }), noteForm("ignored"))).toMatchObject({ ok: true });
    expect(seen.map(({ input }) => input)).toEqual([{ note: "first argument" }]);
    const keyed = noteAction("test.no-form.keyed", "staff", handler, true);
    expect(await keyed(b({ note: "x" }), noteForm("x"))).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["idempotencyKey"] });
  });
});

describe("action(): idempotency", () => {
  it("runs the handler once for the same key and input, and replays the stored response", async () => {
    const { handler } = recordingHandler();
    const run = noteAction("test.replay", "staff", handler, true);
    const key = randomUUID();
    expect(await run(b({ note: "x" }), key)).toEqual({ ok: true, status: "DONE", data: { done: true, n: 1 } });
    expect(await run(b({ note: "x" }), key)).toEqual({ ok: true, status: "REPLAYED", data: { done: true, n: 1 } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await keyRows(owner.workspaceId, key)).toEqual([{ action: "test.replay", response: { done: true, n: 1 } }]);
  });

  it("treats input that differs only in key order as the same request", async () => {
    const { handler } = recordingHandler();
    // A record keeps the submitted key order through Zod, so only the canonical hash makes these equal.
    const input = z.object({ tags: z.record(z.string(), z.record(z.string(), z.number())) });
    const run = action({ name: "test.order", minRole: "staff", input, idempotent: true, handler });
    const key = randomUUID();
    expect((await run(b({ tags: { a: { c: 1, d: 2 }, b: { e: 3 } } }), key)).status).toBe("DONE");
    expect((await run(b({ tags: { b: { e: 3 }, a: { d: 2, c: 1 } } }), key)).status).toBe("REPLAYED");
    expect((await run(b({ tags: { a: { c: 1, d: 3 }, b: { e: 3 } } }), key)).status).toBe("IDEMPOTENCY_KEY_REUSED");
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
      await expect(run(b({ field: value }), key), label).rejects.toThrow(TypeError);
      expect(handler, label).not.toHaveBeenCalled();
      expect(await keyRows(owner.workspaceId, key), label).toEqual([]);
    }
    // An object with no prototype is plain: hashed by its entries like an object literal.
    const { handler } = recordingHandler();
    const input = z.object({ field: z.custom<unknown>(() => true) });
    const run = action({ name: "test.unhashable.null-prototype", minRole: "staff", input, idempotent: true, handler });
    const key = randomUUID();
    expect((await run(b({ field: Object.assign(Object.create(null), { a: 1 }) }), key)).status).toBe("DONE");
    expect((await run(b({ field: { a: 1 } }), key)).status).toBe("REPLAYED");
  });

  it("returns a refusal the handler throws, rolls back its key, and runs the same key again later", async () => {
    let refuse = true;
    const run = noteAction("test.refused", "staff", async ({ tx }) => {
      await tx.execute(sql`select 1`);
      if (refuse) throw new ActionRefusedError("RATE_LIMITED");
      return { done: true };
    }, true);
    const key = randomUUID();
    expect(await run(b({ note: "x" }), key)).toEqual({ ok: false, status: "RATE_LIMITED" });
    expect(await keyRows(owner.workspaceId, key)).toEqual([]);
    refuse = false;
    expect(await run(b({ note: "x" }), key)).toEqual({ ok: true, status: "DONE", data: { done: true } });
  });

  it("returns IDEMPOTENCY_KEY_REUSED for the same key with other input, or for another action", async () => {
    const { handler } = recordingHandler();
    const run = noteAction("test.reuse", "staff", handler, true);
    const key = randomUUID();
    await run(b({ note: "x" }), key);
    expect(await run(b({ note: "y" }), key)).toEqual({ ok: false, status: "IDEMPOTENCY_KEY_REUSED" });
    const otherAction = noteAction("test.other", "staff", handler, true);
    expect(await otherAction(b({ note: "x" }), key)).toEqual({ ok: false, status: "IDEMPOTENCY_KEY_REUSED" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("keeps keys per workspace: the same key in another workspace is a new request", async () => {
    const { handler } = recordingHandler();
    const run = noteAction("test.scope", "staff", handler, true);
    const key = randomUUID();
    expect((await run(b({ note: "x" }), key)).status).toBe("DONE");
    signedInAs(other.cookie, other.workspaceId);
    expect((await run(b({ note: "x" }), key)).status).toBe("DONE");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("leaves no idempotency_key row when the handler throws, so the key can be used again", async () => {
    const failing = vi.fn(async () => {
      throw new Error("handler failed");
    });
    const key = randomUUID();
    await expect(noteAction("test.fail", "staff", failing, true)(b({ note: "x" }), key)).rejects.toThrow(
      "handler failed",
    );
    expect(await keyRows(owner.workspaceId, key)).toEqual([]);
    const { handler } = recordingHandler();
    expect((await noteAction("test.fail", "staff", handler, true)(b({ note: "x" }), key)).status).toBe("DONE");
  });

  it("reclaims an expired key as a new request", async () => {
    const { handler } = recordingHandler();
    const run = noteAction("test.expiry", "staff", handler, true);
    const key = randomUUID();
    await run(b({ note: "x" }), key);
    await admin`update idempotency_key set expires_at = now() - interval '1 second' where key = ${key}`;
    expect(await run(b({ note: "y" }), key)).toEqual({ ok: true, status: "DONE", data: { done: true, n: 2 } });
    expect(await keyRows(owner.workspaceId, key)).toEqual([{ action: "test.expiry", response: { done: true, n: 2 } }]);
  });

  it("stores the key with the expiry from IDEMPOTENCY_KEY_EXPIRY_SECONDS", async () => {
    const { handler } = recordingHandler();
    const key = randomUUID();
    await noteAction("test.ttl", "staff", handler, true)(b({ note: "x" }), key);
    const [row] = await admin<{ seconds: number }[]>`
      select round(extract(epoch from expires_at - created_at))::int as seconds from idempotency_key where key = ${key}`;
    expect(row?.seconds).toBe(24 * 60 * 60);
  });

  it("ignores the key of an action that is not idempotent and stores nothing", async () => {
    const { handler } = recordingHandler();
    const key = randomUUID();
    const run = noteAction("test.plain", "staff", handler);
    expect((await run(b({ note: "x" }), key)).status).toBe("DONE");
    expect((await run(b({ note: "x" }), key)).status).toBe("DONE");
    expect(handler).toHaveBeenCalledTimes(2);
    expect(await keyRows(owner.workspaceId, key)).toEqual([]);
  });
});

describe("action(): redirectTo", () => {
  // A redirect while a page renders is a 307, which repeats a no-JavaScript POST at the new URL; one from the action
  // is a 303. Next's redirect() throws; its digest carries the URL and the status the action handler replaces.
  const redirectTo = (url: string) => expect.objectContaining({ digest: expect.stringContaining(`;${url};`) });

  it("redirects once the transaction has committed, for a done and for a replayed result", async () => {
    const { handler } = recordingHandler();
    const key = randomUUID();
    const run = action({ name: "test.redirect", minRole: "staff", input: noteInput, idempotent: true, handler, redirectTo: "/done" });
    await expect(run(b({ note: "x" }), key)).rejects.toEqual(redirectTo("/done"));
    expect(await keyRows(owner.workspaceId, key)).toEqual([{ action: "test.redirect", response: { done: true, n: 1 } }]);
    await expect(run(b({ note: "x" }), key)).rejects.toEqual(redirectTo("/done"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns a refusal instead of redirecting", async () => {
    const refuse = async (): Promise<Json> => {
      throw new ActionRefusedError("STALE_VERSION");
    };
    const run = action({ name: "test.redirect", minRole: "staff", input: noteInput, idempotent: false, handler: refuse, redirectTo: "/done" });
    expect(await run(b({ note: "x" }))).toEqual({ ok: false, status: "STALE_VERSION" });
    expect(await run(b({ note: "" }))).toMatchObject({ ok: false, status: "INVALID_INPUT" });
    signedInAs(null);
    expect(await run(b({ note: "x" }))).toEqual({ ok: false, status: "UNAUTHENTICATED" });
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
    expect((await run(b({ note: "x" }), randomUUID())).status).toBe("DONE");
    expect(steps).toEqual(["session", "membership", "zod", "idempotency", "handler", "store"]);
  });

  it("runs beforeTransaction after Zod and before the transaction's idempotency step, with the member and input", async () => {
    const { handler } = recordingHandler();
    const input = z.object({ note: z.string() });
    const parse = input.safeParse.bind(input);
    vi.spyOn(input, "safeParse").mockImplementation((value) => {
      steps.push("zod");
      return parse(value);
    });
    const seen: { userId: string; workspaceId: string; input: unknown }[] = [];
    const beforeTransaction = async (member: { userId: string; workspaceId: string }, value: unknown) => {
      steps.push("before");
      seen.push({ userId: member.userId, workspaceId: member.workspaceId, input: value });
    };
    const run = action({ name: "test.before", minRole: "staff", input, idempotent: true, handler, beforeTransaction });
    expect((await run(b({ note: "x" }), randomUUID())).status).toBe("DONE");
    expect(steps).toEqual(["session", "membership", "zod", "before", "idempotency", "handler", "store"]);
    expect(seen).toEqual([{ userId: owner.userId, workspaceId: owner.workspaceId, input: { note: "x" } }]);
  });

  it("returns a refusal thrown by beforeTransaction, and opens no transaction and runs no handler", async () => {
    const { handler } = recordingHandler();
    const run = action({
      name: "test.before",
      minRole: "staff",
      input: noteInput,
      idempotent: true,
      handler,
      beforeTransaction: async () => {
        throw new ActionRefusedError("RATE_LIMITED");
      },
    });
    expect(await run(b({ note: "x" }), randomUUID())).toEqual({ ok: false, status: "RATE_LIMITED" });
    expect(handler).not.toHaveBeenCalled();
    expect(queries.filter((query) => /idempotency_key/.test(query))).toEqual([]);
  });
});
