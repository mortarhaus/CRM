import { hashPassword, verifyPassword } from "@crm/core/password";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor as twoFactorPlugin } from "better-auth/plugins";
import { relations, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { TOTP } from "otpauth";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "../../db/client";
import * as schema from "../../db/schema";
import {
  AUTH_DETAIL_CAUSES,
  AUTH_DETAIL_KEYS,
  AUTH_DETAIL_METHODS,
  AUTH_DETAIL_REASONS,
  AUTH_EVENTS,
  createAuthTransactions,
  SESSION_ISSUE_LABELS,
  SIGN_IN_EMAIL_LOCK_SPACE,
} from "../../db/system";
import { AUTH_AUDIT_FUNCTIONS, AUTH_AUDIT_TRIGGERS, NO_RLS_ALLOW_LIST, policies, triggersOn } from "../../test/catalog";
import {
  type AuthLike,
  auditRows,
  BASE_URL,
  bodyField,
  CLIENT_IP,
  CookieJar,
  call,
  cloneStack,
  failOnce,
  holdAt,
  lockWaiters,
  openStack,
  PASSWORD,
  pauseAdapter,
  type Reply,
  SECRET,
  SESSION_COOKIE,
  sessionTokens,
  sessionsWithoutRow,
  type Stack,
  setsSession,
  signInEmailLockWaiters,
  TRUST_DEVICE_COOKIE,
  TWO_FACTOR_COOKIE,
  twoFactorState,
  USER_AGENT,
  userIdOf,
  waitUntil,
} from "../../test/auth-harness";
import { databaseUrl, MIGRATIONS_DIR, migrationsCopy, sqlState, startDatabase, type TestDatabase } from "../../test/postgres";
import { totpFromUri, wrongTotpCode } from "../../test/totp";
import { authOptions, createAuth, type Auth } from "./config";
import { withRequestTransactions } from "./request-transaction";

// Plan Task 31 (31.B, T1 to T15): auth_audit_log and the 2FA session rules, against a real Better Auth 1.7.14 built
// by createAuth, as crm_app, over HTTP (auth.handler) unless a test names another path. State is read as the
// admin. A test that injects a fault or holds a statement gets a database of its own (a copy of a migrated
// template). After every test, every open database holds the session invariant and only allow-listed row content.

const next = vi.hoisted(() => ({
  headers: new Headers(),
  auth: undefined as unknown,
  setCookie: () => {},
}));
vi.mock("next/headers", () => ({ headers: async () => next.headers, cookies: async () => ({ set: next.setCookie }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("./server", () => ({ getAuth: () => next.auth }));
vi.mock("../env", () => ({ getEnv: () => ({ APP_URL: "http://localhost:3000" }) }));

const TEMPLATE = "auth_audit_template";
const NAME = "Audit Person";

let database: TestDatabase;
let main: Stack;
let auth: Auth;
let clones = 0;
const isolatedStacks: Stack[] = [];

// Every value no row (outside its allow-listed fields) and no log line may hold (R13).
const secrets = new Set<string>([PASSWORD, NAME, USER_AGENT]);
const logged: string[] = [];

function remember(...values: (string | undefined)[]): void {
  for (const value of values) if (value && value.length >= 6) secrets.add(value);
}

function logText(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message} ${String(arg.stack)} ${JSON.stringify(arg.cause ?? null)}`;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

beforeAll(async () => {
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(logText).join(" "));
    });
  }
  database = await startDatabase();
  const root = postgres(databaseUrl(database.adminUrl, "postgres"), { max: 1, onnotice: () => {} });
  try {
    await root.unsafe(`CREATE DATABASE ${TEMPLATE} TEMPLATE "${database.container.getDatabase()}" OWNER crm_migrator`);
  } finally {
    await root.end();
  }
  main = openStack(database, database.container.getDatabase());
  auth = createAuth({ db: main.handle.db, secret: SECRET, baseURL: BASE_URL });
}, 120_000);

afterAll(async () => {
  await main?.close();
  await database?.stop();
  vi.restoreAllMocks();
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VOCABULARY: Record<string, readonly string[]> = {
  reason: AUTH_DETAIL_REASONS,
  method: AUTH_DETAIL_METHODS,
  cause: AUTH_DETAIL_CAUSES,
};

// T13 (b): each row's detail holds only allow-listed keys and labels, `ip` is the client IP the test sent (or
// none, for an instance without the request transaction), and no other field holds a known personal datum or secret.
async function rowContentViolations(admin: postgres.Sql): Promise<string[]> {
  const rows = await admin<{ id: string; event: string; detail: Record<string, unknown> | null; ip: string | null }[]>`
    select id, event, detail, ip from auth_audit_log`;
  const violations: string[] = [];
  for (const row of rows) {
    if (!(AUTH_EVENTS as readonly string[]).includes(row.event)) violations.push(`${row.id}: event ${row.event}`);
    if (row.ip !== null && row.ip !== CLIENT_IP) violations.push(`${row.id}: ip ${row.ip}`);
    const { session_id: sessionId, ...labels } = row.detail ?? {};
    if (row.detail !== null && (typeof sessionId !== "string" || !UUID.test(sessionId))) {
      violations.push(`${row.id}: session_id ${String(sessionId)}`);
    }
    for (const [key, value] of Object.entries(labels)) {
      if (!(AUTH_DETAIL_KEYS as readonly string[]).includes(key)) violations.push(`${row.id}: key ${key}`);
      else if (!VOCABULARY[key]?.includes(String(value))) violations.push(`${row.id}: ${key} ${String(value)}`);
    }
    const text = JSON.stringify({ event: row.event, labels });
    for (const secret of secrets) if (text.includes(secret)) violations.push(`${row.id}: holds a known secret`);
  }
  return violations;
}

// A fault a test installed (failOnce) that never fired: the request failed for another reason, so the test would
// pass without testing its point.
async function faultsNotFired(admin: postgres.Sql): Promise<string[]> {
  const rows = await admin<{ name: string }[]>`
    select sequencename as name from pg_sequences where schemaname = 'test_fixture' and last_value is null order by 1`;
  return rows.map((row) => row.name);
}

afterEach(async () => {
  try {
    for (const stack of [main, ...isolatedStacks]) {
      expect(await sessionsWithoutRow(stack.admin), `session invariant in ${stack.name}`).toEqual([]);
      expect(await rowContentViolations(stack.admin), `row content in ${stack.name}`).toEqual([]);
      expect(await faultsNotFired(stack.admin), `injected faults that never fired in ${stack.name}`).toEqual([]);
    }
  } finally {
    for (const stack of isolatedStacks.splice(0)) await stack.close();
  }
});

// A database of the test's own, with the configured instance on it.
async function isolated(): Promise<{ stack: Stack; auth: Auth }> {
  clones += 1;
  const stack = await cloneStack(database, TEMPLATE, `auth_audit_${clones}`);
  isolatedStacks.push(stack);
  return { stack, auth: createAuth({ db: stack.handle.db, secret: SECRET, baseURL: BASE_URL }) };
}

// Control: the configured options (labels, triggers, plugins), but no request transaction: every statement
// autocommits, as stock Better Auth 1.7.14 runs them (as 1.7.6 did), so the user lock ends with its own statement.
function unserialised(db: Database): AuthLike {
  return betterAuth(authOptions({ db, secret: SECRET, baseURL: BASE_URL }));
}

// The configured instance with one part of its options changed (a protection removed, for a control or a
// layer-alone test).
function configuredWith(db: Database, change: (options: BetterAuthOptions) => BetterAuthOptions): AuthLike {
  const transactions = createAuthTransactions(db);
  const options = change(authOptions({ db, secret: SECRET, baseURL: BASE_URL, adapterDb: transactions.db }));
  return withRequestTransactions(betterAuth(options), transactions);
}

// ---------------------------------------------------------------------------------------------------------------
// Flows over HTTP

async function http(
  instance: AuthLike,
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; jar?: CookieJar; headers?: HeadersInit } = {},
): Promise<Reply> {
  const reply = await call(instance, method, path, options);
  for (const line of reply.setCookies) {
    const value = (line.split(";")[0] ?? "").split("=").slice(1).join("=");
    remember(value, decodeURIComponent(value), decodeURIComponent(value).split(".")[0]);
  }
  const token = bodyField(reply, "token");
  remember(typeof token === "string" ? token : undefined);
  const codes = bodyField(reply, "backupCodes");
  if (Array.isArray(codes)) remember(...codes.map(String));
  return reply;
}

let emailCounter = 0;
function newEmail(): string {
  emailCounter += 1;
  const email = `audit${emailCounter}-${Date.now()}@example.test`;
  remember(email);
  return email;
}

interface Person {
  email: string;
  id: string;
}

interface TwoFactorPerson extends Person {
  totp: TOTP;
  backupCodes: string[];
  // The session the enrolment left (the changer's replacement session).
  jar: CookieJar;
}

async function signUp(instance: AuthLike, admin: postgres.Sql): Promise<Person> {
  const email = newEmail();
  const reply = await http(instance, "POST", "/sign-up/email", { body: { name: NAME, email, password: PASSWORD } });
  expect(reply.status).toBe(200);
  return { email, id: await userIdOf(admin, email) };
}

function passwordStep(instance: AuthLike, email: string, jar?: CookieJar): Promise<Reply> {
  return http(instance, "POST", "/sign-in/email", { body: { email, password: PASSWORD }, jar });
}

function completed(reply: Reply): boolean {
  return reply.status === 200 && bodyField(reply, "twoFactorRedirect") === undefined && setsSession(reply);
}

async function signIn(instance: AuthLike, email: string, jar?: CookieJar): Promise<CookieJar> {
  const reply = await passwordStep(instance, email, jar);
  expect(completed(reply)).toBe(true);
  return reply.jar;
}

async function challenge(instance: AuthLike, email: string, jar?: CookieJar): Promise<CookieJar> {
  const reply = await passwordStep(instance, email, jar);
  expect(reply.status).toBe(200);
  expect(bodyField(reply, "twoFactorRedirect")).toBe(true);
  expect(reply.jar.get(SESSION_COOKIE)).toBeUndefined();
  return reply.jar;
}

function code(totp: TOTP): string {
  const value = totp.generate();
  remember(value);
  return value;
}

function verifyTotp(instance: AuthLike, jar: CookieJar, totp: TOTP): Promise<Reply> {
  return http(instance, "POST", "/two-factor/verify-totp", { body: { code: code(totp) }, jar });
}

function verifyBackupCode(instance: AuthLike, jar: CookieJar, backupCode: string): Promise<Reply> {
  return http(instance, "POST", "/two-factor/verify-backup-code", { body: { code: backupCode }, jar });
}

async function startEnrolment(instance: AuthLike, jar: CookieJar): Promise<{ totp: TOTP; backupCodes: string[] }> {
  const reply = await http(instance, "POST", "/two-factor/enable", { body: { password: PASSWORD }, jar });
  expect(reply.status).toBe(200);
  const uri = bodyField(reply, "totpURI");
  if (typeof uri !== "string") throw new Error("expected a TOTP enrolment");
  const totp = totpFromUri(uri);
  remember(totp.secret.base32, uri);
  return { totp, backupCodes: (bodyField(reply, "backupCodes") as string[]).map(String) };
}

function disable(instance: AuthLike, jar: CookieJar): Promise<Reply> {
  return http(instance, "POST", "/two-factor/disable", { body: { password: PASSWORD }, jar });
}

function regenerate(instance: AuthLike, jar: CookieJar): Promise<Reply> {
  return http(instance, "POST", "/two-factor/generate-backup-codes", { body: { password: PASSWORD }, jar });
}

async function sessionOf(instance: AuthLike, jar: CookieJar): Promise<unknown> {
  const reply = await http(instance, "GET", "/get-session", { jar });
  expect(setsSession(reply)).toBe(false);
  return reply.body;
}

async function withTwoFactor(instance: AuthLike, admin: postgres.Sql): Promise<TwoFactorPerson> {
  const person = await signUp(instance, admin);
  const jar = await signIn(instance, person.email);
  const { totp, backupCodes } = await startEnrolment(instance, jar);
  const confirmed = await verifyTotp(instance, jar, totp);
  expect(confirmed.status).toBe(200);
  expect(setsSession(confirmed)).toBe(true);
  return { ...person, totp, backupCodes, jar: confirmed.jar };
}

async function signInWithTotp(instance: AuthLike, person: TwoFactorPerson): Promise<CookieJar> {
  const reply = await verifyTotp(instance, await challenge(instance, person.email), person.totp);
  expect(completed(reply)).toBe(true);
  return reply.jar;
}

function loginRows(rows: readonly { event: string; detail: Record<string, unknown> | null }[]) {
  return rows.filter((row) => row.event === "session_issued" && row.detail?.reason === "sign_in");
}

function shape(rows: readonly { event: string; detail: Record<string, unknown> | null }[]) {
  return rows.map(({ event, detail }) => {
    const labels = Object.entries(detail ?? {}).filter(([key]) => key !== "session_id");
    return detail === null ? { event } : { event, ...Object.fromEntries(labels) };
  });
}

const LOGIN = { event: "session_issued", reason: "sign_in", method: "password" };
const PENDING = { event: "session_issued", reason: "two_factor_pending", method: "password" };
const rotation = (cause: string) => ({ event: "session_issued", reason: "rotation", cause });
const CODES_CHANGED = { event: "two_factor_backup_codes_changed" };

async function revokeAuditInsert(admin: postgres.Sql): Promise<void> {
  await admin.unsafe("REVOKE INSERT ON public.auth_audit_log FROM crm_app");
}

async function grantAuditInsert(admin: postgres.Sql): Promise<void> {
  await admin.unsafe("GRANT INSERT ON public.auth_audit_log TO crm_app");
}

// A failed request: an error status, no session cookie and no token.
function expectFailedWithoutSession(reply: Reply): void {
  expect(reply.status).toBeGreaterThanOrEqual(400);
  expect(setsSession(reply)).toBe(false);
  expect(bodyField(reply, "token")).toBeUndefined();
}

// ---------------------------------------------------------------------------------------------------------------

describe("T1 (R1): one row per event, keyed by user, with no workspace", () => {
  it("user with no workspace: one login row after sign-in", async () => {
    const person = await signUp(auth, main.admin);
    const jar = await signIn(auth, person.email);
    const rows = await auditRows(main.admin, person.id);
    expect(shape(rows)).toEqual([LOGIN]);
    const [sessionId] = await main.admin<{ id: string }[]>`select id from session where token = ${jar.sessionToken ?? ""}`;
    expect(rows[0]?.detail?.session_id).toBe(sessionId?.id);
    expect(rows[0]?.ip).toBe(CLIENT_IP);
  });

  it("user in two workspaces: one login row, and the table has no workspace column", async () => {
    const person = await signUp(auth, main.admin);
    const jar = await signIn(auth, person.email);
    for (const name of ["First", "Second"]) {
      const created = await http(auth, "POST", "/organization/create", {
        body: { name: `${name} workspace`, slug: `${name.toLowerCase()}-${person.id}` },
        jar,
      });
      expect(created.status).toBe(200);
    }
    await signIn(auth, person.email);
    expect(shape(await auditRows(main.admin, person.id))).toEqual([LOGIN, LOGIN]);
    const columns = await main.admin<{ name: string }[]>`
      select column_name as name from information_schema.columns
      where table_schema = 'public' and table_name = 'auth_audit_log' and column_name like '%workspace%'`;
    expect(columns).toEqual([]);
  });

  it("2FA enable, recovery codes (regeneration) and 2FA disable: one row each, then the changer's session", async () => {
    const person = await withTwoFactor(auth, main.admin);
    const regenerated = await regenerate(auth, person.jar);
    expect(regenerated.status).toBe(200);
    const disabled = await disable(auth, regenerated.jar);
    expect(disabled.status).toBe(200);
    expect(shape(await auditRows(main.admin, person.id))).toEqual([
      LOGIN,
      { event: "two_factor_enabled" },
      rotation("two_factor_enabled"),
      CODES_CHANGED,
      rotation("backup_codes_regenerated"),
      { event: "two_factor_disabled" },
      rotation("two_factor_disabled"),
    ]);
  });

  it("recovery codes (consumption): the recovery-code change row and the login row", async () => {
    const person = await withTwoFactor(auth, main.admin);
    const before = (await auditRows(main.admin, person.id)).length;
    const reply = await verifyBackupCode(auth, await challenge(auth, person.email), person.backupCodes[0] ?? "");
    expect(completed(reply)).toBe(true);
    expect(shape((await auditRows(main.admin, person.id)).slice(before))).toEqual([
      PENDING,
      CODES_CHANGED,
      { event: "two_factor_verified", method: "backup_code" },
      { event: "session_issued", reason: "sign_in", method: "backup_code" },
    ]);
  });

  it("both entry paths: signInAction writes the same one login row", async () => {
    const person = await signUp(auth, main.admin);
    next.auth = auth;
    next.headers = new Headers({ origin: BASE_URL, "x-forwarded-for": CLIENT_IP, "user-agent": USER_AGENT });
    const { signInAction } = await import("../../app/(auth)/sign-in/actions");
    const form = new FormData();
    form.set("email", person.email);
    form.set("password", PASSWORD);
    await expect(signInAction({ error: undefined, fields: {} } as never, form)).rejects.toMatchObject({
      url: "/workspaces",
    });
    const rows = await auditRows(main.admin, person.id);
    expect(shape(rows)).toEqual([LOGIN]);
    expect(rows[0]?.ip).toBe(CLIENT_IP);
  });
});

// crm_app holds no UPDATE on account until plan Task 24 enables the password change; a test database of its own
// gets the two columns Better Auth writes, so /change-password reaches its rotation.
async function grantPasswordChange(admin: postgres.Sql): Promise<void> {
  await admin.unsafe("GRANT UPDATE (password, updated_at) ON public.account TO crm_app");
}

describe("T2 (R2): no session exists without its audit row", () => {
  it("the password-change path reaches its rotation (with the test-only grant): one rotation row, A′ only", async () => {
    const { stack, auth: instance } = await isolated();
    await grantPasswordChange(stack.admin);
    const person = await signUp(instance, stack.admin);
    const jar = await signIn(instance, person.email);
    const other = await signIn(instance, person.email);
    const reply = await http(instance, "POST", "/change-password", {
      body: { currentPassword: PASSWORD, newPassword: `${PASSWORD} changed`, revokeOtherSessions: true },
      jar,
    });
    expect(reply.status).toBe(200);
    expect(setsSession(reply)).toBe(true);
    expect(await sessionOf(instance, other)).toBeNull();
    expect(await sessionTokens(stack.admin, person.id)).toEqual([reply.jar.sessionToken]);
    expect(shape(await auditRows(stack.admin, person.id))).toEqual([LOGIN, LOGIN, rotation("password_changed")]);
  });

  interface Step {
    // Builds the state before the failing request and returns it; prepare() installs the fault.
    setup(instance: Auth, admin: postgres.Sql): Promise<{ userId: string; act(): Promise<Reply>; existing: CookieJar[] }>;
    prepare(admin: postgres.Sql): Promise<void>;
  }

  const steps: [string, Step][] = [
    [
      "password sign-in",
      {
        async setup(instance, admin) {
          const person = await signUp(instance, admin);
          const existing = await signIn(instance, person.email);
          return { userId: person.id, existing: [existing], act: () => passwordStep(instance, person.email) };
        },
        prepare: revokeAuditInsert,
      },
    ],
    [
      "password step of a 2FA user",
      {
        async setup(instance, admin) {
          const person = await withTwoFactor(instance, admin);
          return { userId: person.id, existing: [person.jar], act: () => passwordStep(instance, person.email) };
        },
        prepare: revokeAuditInsert,
      },
    ],
    [
      "second step (TOTP)",
      {
        async setup(instance, admin) {
          const person = await withTwoFactor(instance, admin);
          const jar = await challenge(instance, person.email);
          return { userId: person.id, existing: [person.jar], act: () => verifyTotp(instance, jar, person.totp) };
        },
        prepare: revokeAuditInsert,
      },
    ],
    [
      "second step (recovery code)",
      {
        async setup(instance, admin) {
          const person = await withTwoFactor(instance, admin);
          const jar = await challenge(instance, person.email);
          return {
            userId: person.id,
            existing: [person.jar],
            act: () => verifyBackupCode(instance, jar, person.backupCodes[0] ?? ""),
          };
        },
        prepare: revokeAuditInsert,
      },
    ],
    [
      "rotation on enable",
      {
        async setup(instance, admin) {
          const person = await signUp(instance, admin);
          const jar = await signIn(instance, person.email);
          const { totp } = await startEnrolment(instance, jar);
          return { userId: person.id, existing: [jar], act: () => verifyTotp(instance, jar, totp) };
        },
        prepare: (admin) =>
          failOnce(admin, {
            on: "BEFORE INSERT ON public.auth_audit_log",
            when: "NEW.event = 'session_issued' AND NEW.detail ->> 'cause' = 'two_factor_enabled'",
          }),
      },
    ],
    [
      "rotation on disable",
      {
        async setup(instance, admin) {
          const person = await withTwoFactor(instance, admin);
          return { userId: person.id, existing: [person.jar], act: () => disable(instance, person.jar) };
        },
        prepare: (admin) =>
          failOnce(admin, {
            on: "BEFORE INSERT ON public.auth_audit_log",
            when: "NEW.event = 'session_issued' AND NEW.detail ->> 'cause' = 'two_factor_disabled'",
          }),
      },
    ],
    [
      "rotation on password change",
      {
        async setup(instance, admin) {
          await grantPasswordChange(admin);
          const person = await signUp(instance, admin);
          const jar = await signIn(instance, person.email);
          const act = () =>
            http(instance, "POST", "/change-password", {
              body: { currentPassword: PASSWORD, newPassword: `${PASSWORD} changed`, revokeOtherSessions: true },
              jar,
            });
          return { userId: person.id, existing: [jar], act };
        },
        prepare: (admin) =>
          failOnce(admin, {
            on: "BEFORE INSERT ON public.auth_audit_log",
            when: "NEW.event = 'session_issued' AND NEW.detail ->> 'cause' = 'password_changed'",
          }),
      },
    ],
  ];

  it.each(steps)(
    "forced audit-write failure: no session exists without its row (%s)",
    async (_, step) => {
      const { stack, auth: instance } = await isolated();
      const { userId, existing, act } = await step.setup(instance, stack.admin);
      const tokensBefore = await sessionTokens(stack.admin, userId);
      const rowsBefore = await auditRows(stack.admin, userId);
      await step.prepare(stack.admin);

      const reply = await act();
      expectFailedWithoutSession(reply);
      expect(await sessionTokens(stack.admin, userId)).toEqual(tokensBefore);
      expect(await auditRows(stack.admin, userId)).toEqual(rowsBefore);
      // An existing session lists only the sessions that existed before: the failed login has no token to list or use.
      for (const jar of existing) {
        const listed = await http(instance, "GET", "/list-sessions", { jar });
        expect(listed.status).toBe(200);
        expect((listed.body as unknown[]).length).toBe(tokensBefore.length);
      }
    },
    60_000,
  );

  it("interruption inside the statement: a killed backend leaves neither row, and a run without the kill both", async () => {
    const { stack, auth: instance } = await isolated();
    const person = await signUp(instance, stack.admin);
    // After the audit trigger (AFTER triggers fire by name), so the audit row is already written in the statement.
    const hold = await holdAt(stack.admin, { on: "AFTER INSERT ON public.session", name: "zzz_test_hold" });
    const pending = passwordStep(instance, person.email);
    await hold.reached();
    await hold.kill();
    expectFailedWithoutSession(await pending);
    expect(await sessionTokens(stack.admin, person.id)).toEqual([]);
    expect(await auditRows(stack.admin, person.id)).toEqual([]);

    const jar = await signIn(instance, person.email);
    expect(await sessionTokens(stack.admin, person.id)).toEqual([jar.sessionToken]);
    expect(shape(await auditRows(stack.admin, person.id))).toEqual([LOGIN]);
  });

  it("the password-step session survives a failed Better Auth delete: closed, the request rolls back whole", async () => {
    const { stack, auth: instance } = await isolated();
    const person = await withTwoFactor(instance, stack.admin);
    const rowsBefore = await auditRows(stack.admin, person.id);
    await failOnce(stack.admin, {
      on: "BEFORE DELETE ON public.session",
      when: "OLD.issue_reason = 'password_two_factor'",
    }, "XX000");

    expectFailedWithoutSession(await passwordStep(instance, person.email));
    const [pendingSessions] = await stack.admin<{ count: number }[]>`
      select count(*)::int as count from session where user_id = ${person.id} and issue_reason = 'password_two_factor'`;
    expect(pendingSessions?.count).toBe(0);
    const [challenges] = await stack.admin<{ count: number }[]>`
      select count(*)::int as count from verification where value = ${person.id} and identifier like '2fa-%'`;
    expect(challenges?.count).toBe(0);
    expect(await auditRows(stack.admin, person.id)).toEqual(rowsBefore);

    await signInWithTotp(instance, person);
  });
});

describe("T3 (R3): every login is exactly one login row", () => {
  it("2FA sign-in: one login row per completed login on every path", async () => {
    const person = await withTwoFactor(auth, main.admin);
    const start = (await auditRows(main.admin, person.id)).length;
    await signInWithTotp(auth, person);
    const recovery = await verifyBackupCode(auth, await challenge(auth, person.email), person.backupCodes[1] ?? "");
    expect(completed(recovery)).toBe(true);
    expect(shape((await auditRows(main.admin, person.id)).slice(start))).toEqual([
      PENDING,
      { event: "two_factor_verified", method: "totp" },
      { event: "session_issued", reason: "sign_in", method: "totp" },
      PENDING,
      CODES_CHANGED,
      { event: "two_factor_verified", method: "backup_code" },
      { event: "session_issued", reason: "sign_in", method: "backup_code" },
    ]);

    const plain = await signUp(auth, main.admin);
    await signIn(auth, plain.email);
    expect(shape(await auditRows(main.admin, plain.id))).toEqual([LOGIN]);
  });

  it("failures write nothing", async () => {
    const person = await withTwoFactor(auth, main.admin);
    const start = (await auditRows(main.admin, person.id)).length;
    const wrongPassword = await http(auth, "POST", "/sign-in/email", {
      body: { email: person.email, password: `${PASSWORD} wrong` },
    });
    expect(wrongPassword.status).toBe(401);
    const unknown = await http(auth, "POST", "/sign-in/email", { body: { email: newEmail(), password: PASSWORD } });
    expect(unknown.status).toBe(401);

    const jar = await challenge(auth, person.email);
    const wrongCode = await http(auth, "POST", "/two-factor/verify-totp", { body: { code: wrongTotpCode(person.totp) }, jar });
    expect(wrongCode.status).toBe(401);
    const wrongRecovery = await verifyBackupCode(auth, jar, "aaaaa-bbbbb");
    expect(wrongRecovery.status).toBe(401);
    const noChallenge = await verifyTotp(auth, new CookieJar(), person.totp);
    expect(noChallenge.status).toBeGreaterThanOrEqual(400);

    // The password step of the challenge is recorded as what it is; no failure adds a row.
    expect(shape((await auditRows(main.admin, person.id)).slice(start))).toEqual([PENDING]);
  });

  it("no double rows: requests that write no new session write no row", async () => {
    const person = await signUp(auth, main.admin);
    const jar = await signIn(auth, person.email);
    const other = await signIn(auth, person.email);
    const before = await auditRows(main.admin, person.id);

    expect((await http(auth, "GET", "/get-session", { jar })).status).toBe(200);
    expect((await http(auth, "POST", "/update-user", { body: { name: "Audit Person Renamed" }, jar })).status).toBe(200);
    const created = await http(auth, "POST", "/organization/create", {
      body: { name: "Rows workspace", slug: `rows-${person.id}` },
      jar,
    });
    const workspaceId = bodyField(created, "id");
    expect((await http(auth, "POST", "/organization/set-active", { body: { organizationId: workspaceId }, jar })).status).toBe(200);
    expect((await http(auth, "POST", "/revoke-session", { body: { token: other.sessionToken }, jar })).status).toBe(200);
    expect((await http(auth, "POST", "/sign-out", { jar })).status).toBe(200);

    expect(await auditRows(main.admin, person.id)).toEqual(before);
  });

  it("every Phase 1 path is labelled: each label writes its rows, an unknown or missing label is refused", async () => {
    const app = main.handle.sql;
    const person = await signUp(auth, main.admin);
    const enrolled = await withTwoFactor(auth, main.admin);
    const expected: Record<string, object[]> = {
      password: [LOGIN],
      password_two_factor: [PENDING],
      two_factor_totp: [
        { event: "two_factor_verified", method: "totp" },
        { event: "session_issued", reason: "sign_in", method: "totp" },
      ],
      two_factor_backup_code: [
        { event: "two_factor_verified", method: "backup_code" },
        { event: "session_issued", reason: "sign_in", method: "backup_code" },
      ],
      rotation_two_factor_enabled: [rotation("two_factor_enabled")],
      rotation_two_factor_disabled: [rotation("two_factor_disabled")],
      rotation_backup_codes_regenerated: [rotation("backup_codes_regenerated")],
      rotation_password_changed: [rotation("password_changed")],
    };
    expect(Object.keys(expected).sort()).toEqual([...SESSION_ISSUE_LABELS].sort());
    for (const label of SESSION_ISSUE_LABELS) {
      const userId = label === "password" ? person.id : enrolled.id;
      const before = (await auditRows(main.admin, userId)).length;
      const [inserted] = await app<{ id: string }[]>`
        insert into session (token, user_id, expires_at, updated_at, issue_reason)
        values (${`label-${label}-${Date.now()}`}, ${userId}, now() + interval '1 hour', now(), ${label}) returning id`;
      const rows = (await auditRows(main.admin, userId)).slice(before);
      expect(shape(rows), label).toEqual(expected[label]);
      expect(rows.every((row) => row.detail?.session_id === inserted?.id)).toBe(true);
    }
    for (const label of [null, "unlabelled", "pre_existing"]) {
      expect(
        await sqlState(app`
          insert into session (token, user_id, expires_at, updated_at, issue_reason)
          values (${`bad-${String(label)}-${Date.now()}`}, ${person.id}, now() + interval '1 hour', now(), ${label})`),
      ).toBe("23514");
    }
  });
});

describe("T4 (R4): a 2FA change or a recovery-code consumption commits with its row or not at all", () => {
  const changes: [string, (instance: Auth, admin: postgres.Sql) => Promise<{ userId: string; act(): Promise<Reply>; retry(): Promise<void> }>][] = [
    [
      "2FA enable",
      async (instance, admin) => {
        const person = await signUp(instance, admin);
        const jar = await signIn(instance, person.email);
        const { totp } = await startEnrolment(instance, jar);
        return {
          userId: person.id,
          act: () => verifyTotp(instance, jar, totp),
          async retry() {
            expect((await verifyTotp(instance, jar, totp)).status).toBe(200);
            expect((await twoFactorState(admin, person.id)).enabled).toBe(true);
          },
        };
      },
    ],
    [
      "2FA disable",
      async (instance, admin) => {
        const person = await withTwoFactor(instance, admin);
        return {
          userId: person.id,
          act: () => disable(instance, person.jar),
          async retry() {
            expect((await disable(instance, person.jar)).status).toBe(200);
            expect((await twoFactorState(admin, person.id)).enabled).toBe(false);
          },
        };
      },
    ],
    [
      "recovery-code regeneration",
      async (instance, admin) => {
        const person = await withTwoFactor(instance, admin);
        return {
          userId: person.id,
          act: () => regenerate(instance, person.jar),
          async retry() {
            expect((await regenerate(instance, person.jar)).status).toBe(200);
          },
        };
      },
    ],
    [
      "recovery-code consumption",
      async (instance, admin) => {
        const person = await withTwoFactor(instance, admin);
        const jar = await challenge(instance, person.email);
        const backupCode = person.backupCodes[0] ?? "";
        return {
          userId: person.id,
          act: () => verifyBackupCode(instance, jar, backupCode),
          async retry() {
            // The code was not consumed: it still completes the same challenge.
            expect(completed(await verifyBackupCode(instance, jar, backupCode))).toBe(true);
          },
        };
      },
    ],
  ];

  it.each(changes)(
    "forced audit-write failure: the 2FA change is rolled back (%s)",
    async (_, setup) => {
      const { stack, auth: instance } = await isolated();
      const { userId, act, retry } = await setup(instance, stack.admin);
      const stateBefore = await twoFactorState(stack.admin, userId);
      const tokensBefore = await sessionTokens(stack.admin, userId);
      const rowsBefore = await auditRows(stack.admin, userId);
      await revokeAuditInsert(stack.admin);

      expectFailedWithoutSession(await act());
      expect(await twoFactorState(stack.admin, userId)).toEqual(stateBefore);
      expect(await sessionTokens(stack.admin, userId)).toEqual(tokensBefore);
      expect(await auditRows(stack.admin, userId)).toEqual(rowsBefore);

      await grantAuditInsert(stack.admin);
      await retry();
    },
    60_000,
  );
});

describe("T5 (R5): a 2FA change ends every pre-change session; the changer continues on an audited new one", () => {
  async function expectEnded(instance: AuthLike, admin: postgres.Sql, ...jars: CookieJar[]): Promise<void> {
    for (const jar of jars) {
      expect(await sessionOf(instance, jar)).toBeNull();
      const [row] = await admin<{ count: number }[]>`select count(*)::int as count from session where token = ${jar.sessionToken ?? ""}`;
      expect(row?.count).toBe(0);
    }
  }

  async function expectOnlySession(admin: postgres.Sql, userId: string, jar: CookieJar, cause: string): Promise<void> {
    expect(await sessionTokens(admin, userId)).toEqual([jar.sessionToken]);
    const rows = await auditRows(admin, userId);
    const [replacement] = await admin<{ id: string }[]>`select id from session where token = ${jar.sessionToken ?? ""}`;
    expect(rows.filter((row) => row.detail?.session_id === replacement?.id).map((row) => row.detail)).toEqual([
      { reason: "rotation", cause, session_id: replacement?.id },
    ]);
  }

  it("2FA enable (AUTH-07 part): A and C end, the response sets A′", async () => {
    const person = await signUp(auth, main.admin);
    const a = await signIn(auth, person.email);
    const c = await signIn(auth, person.email);
    const { totp } = await startEnrolment(auth, a);
    const reply = await verifyTotp(auth, a, totp);
    expect(reply.status).toBe(200);
    await expectEnded(auth, main.admin, a, c);
    expect(await sessionOf(auth, reply.jar)).not.toBeNull();
    await expectOnlySession(main.admin, person.id, reply.jar, "two_factor_enabled");
  });

  it("2FA disable (AUTH-07 part): A and C end, the response sets A′", async () => {
    const person = await withTwoFactor(auth, main.admin);
    const c = await signInWithTotp(auth, person);
    const reply = await disable(auth, person.jar);
    expect(reply.status).toBe(200);
    await expectEnded(auth, main.admin, person.jar, c);
    expect(await sessionOf(auth, reply.jar)).not.toBeNull();
    await expectOnlySession(main.admin, person.id, reply.jar, "two_factor_disabled");
  });

  it("recovery codes (regeneration, AUTH-07 part): A and C end, the response carries the codes and sets A′", async () => {
    const person = await withTwoFactor(auth, main.admin);
    const c = await signInWithTotp(auth, person);
    const before = (await auditRows(main.admin, person.id)).length;
    const reply = await regenerate(auth, person.jar);
    expect(reply.status).toBe(200);
    const newCodes = (bodyField(reply, "backupCodes") as string[]).map(String);
    expect(newCodes).toHaveLength(10);
    await expectEnded(auth, main.admin, person.jar, c);
    expect(await sessionOf(auth, reply.jar)).not.toBeNull();
    await expectOnlySession(main.admin, person.id, reply.jar, "backup_codes_regenerated");
    expect(shape((await auditRows(main.admin, person.id)).slice(before))).toEqual([
      CODES_CHANGED,
      rotation("backup_codes_regenerated"),
    ]);

    const old = await verifyBackupCode(auth, await challenge(auth, person.email), person.backupCodes[0] ?? "");
    expect(old.status).toBe(401);
    expect(completed(await verifyBackupCode(auth, await challenge(auth, person.email), newCodes[0] ?? ""))).toBe(true);
  });

  const regenerationParts: [string, string, string?][] = [
    ["the code write", "BEFORE UPDATE OF backup_codes ON public.two_factor"],
    ["ending the pre-change sessions", "BEFORE DELETE ON public.session"],
    ["inserting A′", "BEFORE INSERT ON public.session", "NEW.issue_reason = 'rotation_backup_codes_regenerated'"],
    ["the recovery-code change row", "BEFORE INSERT ON public.auth_audit_log", "NEW.event = 'two_factor_backup_codes_changed'"],
    ["A′'s session_issued row", "BEFORE INSERT ON public.auth_audit_log", "NEW.event = 'session_issued'"],
  ];

  async function regenerationSetup(instance: Auth, admin: postgres.Sql) {
    const person = await withTwoFactor(instance, admin);
    const c = await signInWithTotp(instance, person);
    return {
      person,
      c,
      state: await twoFactorState(admin, person.id),
      tokens: await sessionTokens(admin, person.id),
      rows: await auditRows(admin, person.id),
    };
  }

  async function expectEntirelyOld(instance: Auth, admin: postgres.Sql, setup: Awaited<ReturnType<typeof regenerationSetup>>) {
    const { person, c } = setup;
    expect(await twoFactorState(admin, person.id)).toEqual(setup.state);
    expect(await sessionTokens(admin, person.id)).toEqual(setup.tokens);
    expect(await auditRows(admin, person.id)).toEqual(setup.rows);
    expect(await sessionOf(instance, person.jar)).not.toBeNull();
    expect(await sessionOf(instance, c)).not.toBeNull();
    // An old code still works.
    expect(completed(await verifyBackupCode(instance, await challenge(instance, person.email), person.backupCodes[2] ?? ""))).toBe(true);
  }

  it.each(regenerationParts)(
    "(c2) a forced failure at %s fails the request and changes nothing",
    async (_, on, when) => {
      const { stack, auth: instance } = await isolated();
      const setup = await regenerationSetup(instance, stack.admin);
      await failOnce(stack.admin, { on, when }, "XX000");
      expectFailedWithoutSession(await regenerate(instance, setup.person.jar));
      await expectEntirelyOld(instance, stack.admin, setup);
    },
    60_000,
  );

  it.each(regenerationParts)(
    "(c3) the connection killed at %s leaves the state entirely old",
    async (_, on, when) => {
      const { stack, auth: instance } = await isolated();
      const setup = await regenerationSetup(instance, stack.admin);
      const hold = await holdAt(stack.admin, { on, when });
      const pending = regenerate(instance, setup.person.jar);
      await hold.reached();
      await hold.kill();
      expectFailedWithoutSession(await pending);
      await expectEntirelyOld(instance, stack.admin, setup);
    },
    60_000,
  );

  it("(c3) a response lost after the commit leaves the state entirely new, and the user signs in again", async () => {
    const { stack, auth: instance } = await isolated();
    const setup = await regenerationSetup(instance, stack.admin);
    const lost = await regenerate(instance, setup.person.jar);
    expect(lost.status).toBe(200);
    await expectEnded(instance, stack.admin, setup.person.jar, setup.c);
    expect(await sessionTokens(stack.admin, setup.person.id)).toEqual([lost.jar.sessionToken]);
    const fresh = await signInWithTotp(instance, setup.person);
    expect(await sessionOf(instance, fresh)).not.toBeNull();
  });

  it("negative case (consumption): a recovery-code sign-in ends no other session", async () => {
    const person = await withTwoFactor(auth, main.admin);
    const c = await signInWithTotp(auth, person);
    const before = (await auditRows(main.admin, person.id)).length;
    const backupCode = person.backupCodes[3] ?? "";
    const b = await verifyBackupCode(auth, await challenge(auth, person.email), backupCode);
    expect(completed(b)).toBe(true);
    expect(await sessionOf(auth, person.jar)).not.toBeNull();
    expect(await sessionOf(auth, c)).not.toBeNull();
    const rows = shape((await auditRows(main.admin, person.id)).slice(before));
    expect(rows.filter((row) => row.event === "two_factor_backup_codes_changed")).toHaveLength(1);
    expect(loginRows((await auditRows(main.admin, person.id)).slice(before)).map((row) => row.detail?.method)).toEqual([
      "backup_code",
    ]);
    expect((await verifyBackupCode(auth, await challenge(auth, person.email), backupCode)).status).toBe(401);
  });

  describe("(c4) regeneration versus a recovery-code sign-in, in both commit orders", () => {
    it("order 1, sign-in first: the regeneration waits for B, then ends B's session", async () => {
      const { stack, auth: instance } = await isolated();
      const person = await withTwoFactor(instance, stack.admin);
      const k = person.backupCodes[0] ?? "";
      const bJar = await challenge(instance, person.email);
      const before = (await auditRows(stack.admin, person.id)).length;
      const hold = await holdAt(stack.admin, {
        on: "BEFORE INSERT ON public.session",
        when: "NEW.issue_reason = 'two_factor_backup_code'",
      });
      const b = verifyBackupCode(instance, bJar, k);
      await hold.reached();
      const a = regenerate(instance, person.jar);
      await waitUntil(async () => (await lockWaiters(stack.admin)) > 0, "the regeneration to wait for B");
      await hold.release();
      const [bReply, aReply] = await Promise.all([b, a]);
      expect(completed(bReply)).toBe(true);
      expect(aReply.status).toBe(200);

      await expectEnded(instance, stack.admin, bReply.jar, person.jar);
      expect(await sessionOf(instance, aReply.jar)).not.toBeNull();
      expect(await sessionTokens(stack.admin, person.id)).toEqual([aReply.jar.sessionToken]);
      expect(shape((await auditRows(stack.admin, person.id)).slice(before))).toEqual([
        CODES_CHANGED,
        { event: "two_factor_verified", method: "backup_code" },
        { event: "session_issued", reason: "sign_in", method: "backup_code" },
        CODES_CHANGED,
        rotation("backup_codes_regenerated"),
      ]);
      expect((await verifyBackupCode(instance, await challenge(instance, person.email), k)).status).toBe(401);
      const k1 = (bodyField(aReply, "backupCodes") as string[])[0] ?? "";
      expect(completed(await verifyBackupCode(instance, await challenge(instance, person.email), k1))).toBe(true);
    });

    it("order 2, regeneration first: B, paused before it takes the user lock, is refused", async () => {
      const { stack, auth: instance } = await isolated();
      const person = await withTwoFactor(instance, stack.admin);
      const k = person.backupCodes[0] ?? "";
      const bJar = await challenge(instance, person.email);
      // The serialising lock's key: B's before-hook reads its challenge here, then locks the user.
      const pause = await pauseAdapter(instance, "findVerificationValue", (identifier) =>
        /^2fa-(?!attempts-)/.test(String(identifier)),
      );
      try {
        const b = verifyBackupCode(instance, bJar, k);
        await pause.reached;
        const aReply = await regenerate(instance, person.jar);
        expect(aReply.status).toBe(200);
        const written = await twoFactorState(stack.admin, person.id);
        const before = (await auditRows(stack.admin, person.id)).length;
        pause.release();
        const bReply = await b;
        expectFailedWithoutSession(bReply);

        expect(await sessionTokens(stack.admin, person.id)).toEqual([aReply.jar.sessionToken]);
        expect((await auditRows(stack.admin, person.id)).slice(before)).toEqual([]);
        expect((await twoFactorState(stack.admin, person.id)).row?.backupCodes).toBe(written.row?.backupCodes);
        for (const old of person.backupCodes.slice(0, 2)) {
          expect((await verifyBackupCode(instance, await challenge(instance, person.email), old)).status).toBe(401);
        }
        const k1 = (bodyField(aReply, "backupCodes") as string[])[0] ?? "";
        expect(completed(await verifyBackupCode(instance, await challenge(instance, person.email), k1))).toBe(true);
      } finally {
        pause.restore();
      }
    });

    it("control: without the serialisation, B's session inserted after the regeneration commit still works", async () => {
      const { stack } = await isolated();
      const control = unserialised(stack.handle.db);
      const person = await withTwoFactor(control, stack.admin);
      const bJar = await challenge(control, person.email);
      const hold = await holdAt(stack.admin, {
        on: "BEFORE INSERT ON public.session",
        when: "NEW.issue_reason = 'two_factor_backup_code'",
      });
      const b = verifyBackupCode(control, bJar, person.backupCodes[0] ?? "");
      await hold.reached();
      const aReply = await regenerate(control, person.jar);
      expect(aReply.status).toBe(200);
      await hold.release();
      const bReply = await b;
      expect(completed(bReply)).toBe(true);
      // The defect: a session authorized by a pre-regeneration code, inserted after the regeneration committed.
      expect(await sessionOf(control, bReply.jar)).not.toBeNull();
    });
  });
});

describe("T6 (R6): no password-only session survives a completed enable, in both orders", () => {
  async function enrolling(instance: AuthLike, admin: postgres.Sql) {
    const person = await signUp(instance, admin);
    const changer = await signIn(instance, person.email);
    const { totp } = await startEnrolment(instance, changer);
    return { person, changer, totp };
  }

  it("0→1, sign-in stored first (L1): the enable waits for it, then ends it", async () => {
    const { stack, auth: instance } = await isolated();
    const { person, changer, totp } = await enrolling(instance, stack.admin);
    const hold = await holdAt(stack.admin, { on: "BEFORE INSERT ON public.session", when: "NEW.issue_reason = 'password'" });
    const signingIn = passwordStep(instance, person.email);
    await hold.reached();
    const enabling = verifyTotp(instance, changer, totp);
    await waitUntil(async () => (await lockWaiters(stack.admin)) > 0, "the enable to wait for the sign-in");
    await hold.release();
    const [signedIn, enabled] = await Promise.all([signingIn, enabling]);
    expect(completed(signedIn)).toBe(true);
    expect(enabled.status).toBe(200);
    expect(await sessionOf(instance, signedIn.jar)).toBeNull();
    expect(await sessionTokens(stack.admin, person.id)).toEqual([enabled.jar.sessionToken]);
  });

  it("0→1, enable committed first (L2): the sign-in waits for it and gets the challenge", async () => {
    const { stack, auth: instance } = await isolated();
    const { person, changer, totp } = await enrolling(instance, stack.admin);
    const hold = await holdAt(stack.admin, { on: "BEFORE UPDATE OF verified ON public.two_factor" });
    const enabling = verifyTotp(instance, changer, totp);
    await hold.reached();
    const signingIn = passwordStep(instance, person.email);
    await waitUntil(async () => (await lockWaiters(stack.admin)) > 0, "the sign-in to wait for the enable");
    await hold.release();
    const [enabled, signedIn] = await Promise.all([enabling, signingIn]);
    expect(enabled.status).toBe(200);
    expect(bodyField(signedIn, "twoFactorRedirect")).toBe(true);
    expect(setsSession(signedIn)).toBe(false);
    expect(await sessionTokens(stack.admin, person.id)).toEqual([enabled.jar.sessionToken]);
  });

  it("1→0, both orders: no session is issued with a decision that predates the committed disable", async () => {
    // Sign-in first: its challenge commits, then the disable ends it (the challenge can no longer complete).
    {
      const { stack, auth: instance } = await isolated();
      const person = await withTwoFactor(instance, stack.admin);
      const hold = await holdAt(stack.admin, {
        on: "BEFORE INSERT ON public.session",
        when: "NEW.issue_reason = 'password_two_factor'",
      });
      const signingIn = passwordStep(instance, person.email);
      await hold.reached();
      const disabling = disable(instance, person.jar);
      await waitUntil(async () => (await lockWaiters(stack.admin)) > 0, "the disable to wait for the sign-in");
      await hold.release();
      const [signedIn, disabled] = await Promise.all([signingIn, disabling]);
      expect(bodyField(signedIn, "twoFactorRedirect")).toBe(true);
      expect(disabled.status).toBe(200);
      expect((await verifyTotp(instance, signedIn.jar, person.totp)).status).toBeGreaterThanOrEqual(400);
      expect(await sessionTokens(stack.admin, person.id)).toEqual([disabled.jar.sessionToken]);
    }
    // Disable first: the sign-in waits, then decides on the committed state (no 2FA) and is one login.
    {
      const { stack, auth: instance } = await isolated();
      const person = await withTwoFactor(instance, stack.admin);
      const hold = await holdAt(stack.admin, {
        on: "BEFORE INSERT ON public.session",
        when: "NEW.issue_reason = 'rotation_two_factor_disabled'",
      });
      const disabling = disable(instance, person.jar);
      await hold.reached();
      const signingIn = passwordStep(instance, person.email);
      await waitUntil(async () => (await lockWaiters(stack.admin)) > 0, "the sign-in to wait for the disable");
      await hold.release();
      const [disabled, signedIn] = await Promise.all([disabling, signingIn]);
      expect(disabled.status).toBe(200);
      expect(completed(signedIn)).toBe(true);
      const rows = await auditRows(stack.admin, person.id);
      expect(rows.at(-1)?.detail).toMatchObject({ reason: "sign_in", method: "password" });
    }
  });

  it("the database check alone refuses a stale session, in both directions", async () => {
    // 0→1: an unserialised sign-in decided before the enable, stored after it.
    {
      const { stack, auth: instance } = await isolated();
      const control = unserialised(stack.handle.db);
      const { person, changer, totp } = await enrolling(instance, stack.admin);
      const hold = await holdAt(stack.admin, { on: "BEFORE INSERT ON public.session", when: "NEW.issue_reason = 'password'" });
      const signingIn = passwordStep(control, person.email);
      await hold.reached();
      expect((await verifyTotp(instance, changer, totp)).status).toBe(200);
      await hold.release();
      expectFailedWithoutSession(await signingIn);
      expect(await sessionTokens(stack.admin, person.id)).toHaveLength(1);
    }
    // 1→0: an unserialised challenge decided before the disable, stored after it.
    {
      const { stack, auth: instance } = await isolated();
      const control = unserialised(stack.handle.db);
      const person = await withTwoFactor(instance, stack.admin);
      const hold = await holdAt(stack.admin, {
        on: "BEFORE INSERT ON public.session",
        when: "NEW.issue_reason = 'password_two_factor'",
      });
      const signingIn = passwordStep(control, person.email);
      await hold.reached();
      expect((await disable(instance, person.jar)).status).toBe(200);
      await hold.release();
      expect((await signingIn).status).toBeGreaterThanOrEqual(500);
    }
  });

  it("control: without the lock and the check, Bob's Round 7 bypass leaves a password-only session", async () => {
    const { stack, auth: instance } = await isolated();
    await stack.admin.unsafe("DROP TRIGGER session_two_factor_check ON public.session");
    const control = unserialised(stack.handle.db);
    const { person, changer, totp } = await enrolling(instance, stack.admin);
    const hold = await holdAt(stack.admin, { on: "BEFORE INSERT ON public.session", when: "NEW.issue_reason = 'password'" });
    const signingIn = passwordStep(control, person.email);
    await hold.reached();
    expect((await verifyTotp(instance, changer, totp)).status).toBe(200);
    await hold.release();
    const signedIn = await signingIn;
    expect(completed(signedIn)).toBe(true);
    expect((await twoFactorState(stack.admin, person.id)).enabled).toBe(true);
    expect(await sessionOf(control, signedIn.jar)).not.toBeNull();
  });

  it("lock-timeout run: a sign-in that cannot get its user within the timeout fails with no change", async () => {
    const { stack, auth: instance } = await isolated();
    const person = await signUp(instance, stack.admin);
    const holder = await stack.admin.reserve();
    try {
      await holder`begin`;
      await holder`select id from "user" where id = ${person.id} for update`;
      const started = Date.now();
      expectFailedWithoutSession(await passwordStep(instance, person.email));
      expect(Date.now() - started).toBeGreaterThanOrEqual(4_500);
    } finally {
      await holder`rollback`;
      holder.release();
    }
    expect(await sessionTokens(stack.admin, person.id)).toEqual([]);
    expect(await auditRows(stack.admin, person.id)).toEqual([]);
    expect(logged.some((line) => line.includes("(55P03)"))).toBe(true);
  }, 30_000);
});

describe("T7 (R7): a concurrent 2FA change never gives a login row that disagrees with the result", () => {
  type Direction = "0→1" | "1→0";

  async function race(instance: AuthLike, direction: Direction, seam: 1 | 2, stack: Stack, serialised: boolean) {
    const enrolling = direction === "0→1";
    const person = enrolling ? await signUp(instance, stack.admin) : await withTwoFactor(instance, stack.admin);
    const changer = enrolling ? await signIn(instance, person.email) : (person as TwoFactorPerson).jar;
    const totp = enrolling ? (await startEnrolment(instance, changer)).totp : undefined;
    const change = () => (totp ? verifyTotp(instance, changer, totp) : disable(instance, changer));
    const before = (await auditRows(stack.admin, person.id)).length;

    // Seam 1: between the challenge decision (the user read) and the label (findUserById). Seam 2: between the
    // label and the session insert.
    let release: () => Promise<void>;
    let signingIn: Promise<Reply>;
    if (seam === 1) {
      const pause = await pauseAdapter(instance, "findUserById", (id) => id === person.id);
      signingIn = passwordStep(instance, person.email);
      await pause.reached;
      release = async () => {
        pause.release();
        pause.restore();
      };
    } else {
      const hold = await holdAt(stack.admin, { on: "BEFORE INSERT ON public.session", when: "NEW.issue_reason LIKE 'password%'" });
      signingIn = passwordStep(instance, person.email);
      await hold.reached();
      release = hold.release;
    }
    const changing = change();
    if (serialised) await waitUntil(async () => (await lockWaiters(stack.admin)) > 0, "the change to wait for the sign-in");
    else expect((await changing).status).toBe(200);
    await release();
    const [signedIn, changed] = await Promise.all([signingIn, changing]);
    expect(changed.status).toBe(200);
    const logins = loginRows((await auditRows(stack.admin, person.id)).slice(before));
    return { completedLogin: completed(signedIn), logins: logins.length, failed: signedIn.status >= 500 };
  }

  const cases: [Direction, 1 | 2][] = [
    ["0→1", 1],
    ["0→1", 2],
    ["1→0", 1],
    ["1→0", 2],
  ];

  it.each(cases)("concurrent 2FA flag change during a sign-in (%s, seam %i): one login row exactly when the login completed", async (direction, seam) => {
    const { stack, auth: instance } = await isolated();
    const { completedLogin, logins } = await race(instance, direction, seam, stack, true);
    expect(logins).toBe(completedLogin ? 1 : 0);
  }, 60_000);

  it.each(["0→1", "1→0"] as Direction[])("control (%s, seam 1): without the lock, Bob's Round 6 disagreement appears", async (direction) => {
    const { stack } = await isolated();
    const { completedLogin, logins } = await race(unserialised(stack.handle.db), direction, 1, stack, false);
    expect(logins).not.toBe(completedLogin ? 1 : 0);
  }, 60_000);
});

describe("T8 (R8): a trusted-device cookie cannot skip the 2FA challenge", () => {
  it("each trust layer alone: the database refuses the record when the input check is gone", async () => {
    const { stack } = await isolated();
    const withoutInputCheck = configuredWith(stack.handle.db, (options) => ({ ...options, hooks: {} }));
    const person = await withTwoFactor(withoutInputCheck, stack.admin);
    const jar = await challenge(withoutInputCheck, person.email);
    const reply = await http(withoutInputCheck, "POST", "/two-factor/verify-totp", {
      body: { code: code(person.totp), trustDevice: true },
      jar,
    });
    expectFailedWithoutSession(reply);
    expect(reply.setCookies.some((line) => line.startsWith(`${TRUST_DEVICE_COOKIE}=`))).toBe(false);
    const [records] = await stack.admin<{ count: number }[]>`
      select count(*)::int as count from verification where identifier like 'trust-device-%'`;
    expect(records?.count).toBe(0);
    expect(await sessionTokens(stack.admin, person.id)).toEqual([person.jar.sessionToken]);
  });

  it("each trust layer alone: the input check refuses trustDevice when the database refusal is gone", async () => {
    const { stack, auth: instance } = await isolated();
    await stack.admin.unsafe("DROP TRIGGER verification_refuse_trusted_device ON public.verification");
    const person = await withTwoFactor(instance, stack.admin);
    const jar = await challenge(instance, person.email);
    const reply = await http(instance, "POST", "/two-factor/verify-totp", {
      body: { code: code(person.totp), trustDevice: true },
      jar,
    });
    expect(reply.status).toBe(400);
    expect(bodyField(reply, "code")).toBe("TRUST_DEVICE_DISABLED");
    const [records] = await stack.admin<{ count: number }[]>`
      select count(*)::int as count from verification where identifier like 'trust-device-%'`;
    expect(records?.count).toBe(0);
  });
});

describe("T9 (R9): trusted devices are refused", () => {
  it("trusted devices refused: 400 on both verify paths with trustDevice: true", async () => {
    const person = await withTwoFactor(auth, main.admin);
    const jar = await challenge(auth, person.email);
    const totp = await http(auth, "POST", "/two-factor/verify-totp", { body: { code: code(person.totp), trustDevice: true }, jar });
    const recovery = await http(auth, "POST", "/two-factor/verify-backup-code", {
      body: { code: person.backupCodes[0], trustDevice: true },
      jar,
    });
    const otp = await http(auth, "POST", "/two-factor/verify-otp", { body: { code: "123456", trustDevice: true }, jar });
    for (const reply of [totp, recovery, otp]) {
      expect(reply.status).toBe(400);
      expect(bodyField(reply, "code")).toBe("TRUST_DEVICE_DISABLED");
      expect(setsSession(reply)).toBe(false);
    }
    // The challenge is untouched: it still completes, without a trust cookie.
    const finished = await verifyTotp(auth, jar, person.totp);
    expect(completed(finished)).toBe(true);
    expect(finished.setCookies.some((line) => line.startsWith(`${TRUST_DEVICE_COOKIE}=`))).toBe(false);
  });

  it("trusted-device records are refused for every writer", async () => {
    const person = await signUp(auth, main.admin);
    expect(
      await sqlState(main.handle.sql`
        insert into verification (identifier, value, expires_at, updated_at)
        values (${`trust-device-${Date.now()}`}, ${person.id}, now() + interval '1 day', now())`),
    ).toBe("23514");
  });
});

describe("T10 (R10): /list-sessions never returns a session token", () => {
  function tokensIn(value: unknown, tokens: readonly string[]): string[] {
    const text = JSON.stringify(value);
    return tokens.filter((token) => text.includes(token));
  }

  it("`/list-sessions` gives no token: the stock endpoint does, the configured one on no entry path", async () => {
    const { stack } = await isolated();
    const unprotected = configuredWith(stack.handle.db, (options) => ({
      ...options,
      plugins: (options.plugins ?? []).filter((plugin) => plugin.id !== "crm-session-audit"),
    }));
    const person = await signUp(unprotected, stack.admin);
    const jar = await signIn(unprotected, person.email);
    const other = await signIn(unprotected, person.email);
    const tokens = [jar.sessionToken ?? "", other.sessionToken ?? ""];
    const stock = await http(unprotected, "GET", "/list-sessions", { jar });
    expect(tokensIn(stock.body, tokens)).toEqual(tokens);

    const configured = createAuth({ db: stack.handle.db, secret: SECRET, baseURL: BASE_URL });
    const viaHandler = await http(configured, "GET", "/list-sessions", { jar });
    expect(viaHandler.status).toBe(200);
    expect(viaHandler.body).toHaveLength(2);
    const viaApi = await configured.api.listSessions({ headers: jar.headers() });
    expect(viaApi).toHaveLength(2);
    next.auth = configured;
    next.headers = jar.headers({ origin: BASE_URL });
    const { postToAuth } = await import("./forward");
    const viaForward = await postToAuth("/list-sessions", {});
    for (const listed of [viaHandler.body, viaApi, viaForward.data]) {
      expect(tokensIn(listed, tokens)).toEqual([]);
      for (const entry of Array.isArray(listed) ? listed : []) {
        expect(Object.keys(entry as object).sort()).toEqual(
          ["createdAt", "expiresAt", "id", "ipAddress", "updatedAt", "userAgent", "userId"].filter((key) => key in (entry as object)),
        );
      }
    }
  });
});

describe("T11 (R11): no failure or interruption during 2FA enrolment or disable locks the user out", () => {
  interface Point {
    label: string;
    on: string;
    when?: string;
  }

  const enrolmentPoints: Point[] = [
    { label: "the flag update", on: "BEFORE UPDATE OF two_factor_enabled ON public.\"user\"" },
    { label: "the two_factor_enabled row", on: "BEFORE INSERT ON public.auth_audit_log", when: "NEW.event = 'two_factor_enabled'" },
    { label: "the revocation of the user's sessions", on: "BEFORE DELETE ON public.session" },
    {
      label: "the replacement (rotation) session insert",
      on: "BEFORE INSERT ON public.session",
      when: "NEW.issue_reason = 'rotation_two_factor_enabled'",
    },
    {
      label: "the replacement's session_issued row",
      on: "BEFORE INSERT ON public.auth_audit_log",
      when: "NEW.event = 'session_issued'",
    },
    { label: "the verified = true write", on: "BEFORE UPDATE OF verified ON public.two_factor" },
  ];

  const disablePoints: Point[] = [
    { label: "the flag cleared", on: "BEFORE UPDATE OF two_factor_enabled ON public.\"user\"" },
    { label: "the two_factor_disabled row", on: "BEFORE INSERT ON public.auth_audit_log", when: "NEW.event = 'two_factor_disabled'" },
    { label: "the revocation of the user's sessions", on: "BEFORE DELETE ON public.session", when: "OLD.issue_reason <> 'rotation_two_factor_disabled'" },
    { label: "the two_factor row delete", on: "BEFORE DELETE ON public.two_factor" },
    {
      label: "the rotation insert",
      on: "BEFORE INSERT ON public.session",
      when: "NEW.issue_reason = 'rotation_two_factor_disabled'",
    },
    {
      label: "the rotation's session_issued row",
      on: "BEFORE INSERT ON public.auth_audit_log",
      when: "NEW.event = 'session_issued'",
    },
  ];

  type Injection = "audit or statement failure" | "connection killed";

  async function inject(admin: postgres.Sql, point: Point, injection: Injection, act: () => Promise<Reply>): Promise<Reply> {
    if (injection === "audit or statement failure") {
      // A forced audit-write failure is a refused insert (42501); any other statement fails with an internal error.
      await failOnce(admin, { on: point.on, when: point.when }, point.on.includes("auth_audit_log") ? "42501" : "XX000");
      return act();
    }
    const hold = await holdAt(admin, { on: point.on, when: point.when });
    const pending = act();
    await hold.reached();
    await hold.kill();
    return pending;
  }

  const injections: Injection[] = ["audit or statement failure", "connection killed"];

  it.each(enrolmentPoints.flatMap((point) => injections.map((injection) => [point.label, injection, point] as const)))(
    "enrolment, %s, %s: nothing changes, and the user completes enrolment with password and authenticator",
    async (_, injection, point) => {
      const { stack, auth: instance } = await isolated();
      const person = await signUp(instance, stack.admin);
      const a = await signIn(instance, person.email);
      const { totp } = await startEnrolment(instance, a);
      const state = await twoFactorState(stack.admin, person.id);

      expectFailedWithoutSession(await inject(stack.admin, point, injection, () => verifyTotp(instance, a, totp)));
      expect(await twoFactorState(stack.admin, person.id)).toEqual(state);
      expect(await sessionTokens(stack.admin, person.id)).toEqual([a.sessionToken]);
      // A completes the same enrolment (or restarts it and completes it) with no admin statement.
      expect(await sessionOf(instance, a)).not.toBeNull();
      const finished = await verifyTotp(instance, a, totp);
      expect(finished.status).toBe(200);
      expect((await twoFactorState(stack.admin, person.id)).row?.verified).toBe(true);
      // The completed 2FA cannot be skipped: the password alone gets the challenge.
      await challenge(instance, person.email);
      await signInWithTotp(instance, { ...person, totp, backupCodes: [], jar: finished.jar });
    },
    60_000,
  );

  it.each(disablePoints.flatMap((point) => injections.map((injection) => [point.label, injection, point] as const)))(
    "disable, %s, %s: nothing changes, and the user disables again",
    async (_, injection, point) => {
      const { stack, auth: instance } = await isolated();
      const person = await withTwoFactor(instance, stack.admin);
      const state = await twoFactorState(stack.admin, person.id);

      expectFailedWithoutSession(await inject(stack.admin, point, injection, () => disable(instance, person.jar)));
      expect(await twoFactorState(stack.admin, person.id)).toEqual(state);
      expect(await sessionTokens(stack.admin, person.id)).toEqual([person.jar.sessionToken]);
      // 2FA is still in force, and the user still holds a session to disable it from.
      await challenge(instance, person.email);
      const disabled = await disable(instance, person.jar);
      expect(disabled.status).toBe(200);
      await signIn(instance, person.email);
    },
    60_000,
  );

  it("enrolment start: a failed restart of enrolment changes nothing, and enrolment then completes", async () => {
    const { stack, auth: instance } = await isolated();
    const person = await signUp(instance, stack.admin);
    const a = await signIn(instance, person.email);
    await failOnce(stack.admin, { on: "BEFORE INSERT ON public.two_factor" }, "XX000");
    const failed = await http(instance, "POST", "/two-factor/enable", { body: { password: PASSWORD }, jar: a });
    expect(failed.status).toBe(500);
    expect((await twoFactorState(stack.admin, person.id)).row).toBeNull();
    const { totp } = await startEnrolment(instance, a);
    expect((await verifyTotp(instance, a, totp)).status).toBe(200);
  });

  it("control: Bob's Round 8 lockout on the Round 7 candidate (revocation in the flag's statement, no transaction)", async () => {
    const { stack } = await isolated();
    const control = unserialised(stack.handle.db);
    const person = await signUp(control, stack.admin);
    const a = await signIn(control, person.email);
    const { totp } = await startEnrolment(control, a);
    await failOnce(stack.admin, { on: "BEFORE UPDATE OF verified ON public.two_factor" }, "XX000");
    const failed = await verifyTotp(control, a, totp);
    expectFailedWithoutSession(failed);

    const state = await twoFactorState(stack.admin, person.id);
    expect(state.enabled).toBe(true);
    expect(state.row?.verified).toBe(false);
    // A is gone; the replacement committed, but its cookie was never sent, so the user holds no session.
    expect(await sessionOf(control, a)).toBeNull();
    expect(await sessionTokens(stack.admin, person.id)).not.toContain(a.sessionToken);
    // Locked out: the challenge cannot complete with the authenticator, and there is no session to restart from.
    const jar = await challenge(control, person.email);
    expect((await verifyTotp(control, jar, totp)).status).toBe(400);
    expect((await http(control, "POST", "/two-factor/enable", { body: { password: PASSWORD }, jar })).status).toBe(401);
  });
});

describe("T12 (R12): append-only, no reader, system module only", () => {
  it("no runtime role reads, changes, deletes or truncates auth_audit_log (42501)", async () => {
    for (const url of [main.appUrl, databaseUrl(database.workerUrl, main.name), databaseUrl(database.purgeUrl, main.name)]) {
      const role = postgres(url, { max: 1, onnotice: () => {} });
      try {
        for (const statement of [
          "select * from public.auth_audit_log",
          "update public.auth_audit_log set event = event",
          "delete from public.auth_audit_log",
          "truncate public.auth_audit_log",
        ]) {
          expect(await sqlState(role.unsafe(statement)), statement).toBe("42501");
        }
      } finally {
        await role.end();
      }
    }
  });

  it("is on the no-RLS allow-list (eleven tables) and has no policy", async () => {
    expect(NO_RLS_ALLOW_LIST).toHaveLength(11);
    expect(NO_RLS_ALLOW_LIST).toContain("auth_audit_log");
    expect(await policies(main.admin, "public", "auth_audit_log")).toEqual([]);
    const [row] = await main.admin<{ rls: boolean }[]>`
      select relrowsecurity as rls from pg_class where oid = 'public.auth_audit_log'::regclass`;
    expect(row?.rls).toBe(false);
  });
});

describe("T13 (R13): a row holds only the allow-listed fields", () => {
  it("(a) column allow-list: exactly id, user_id, event, detail, ip, created_at", async () => {
    const columns = await main.admin<{ name: string }[]>`
      select column_name as name from information_schema.columns
      where table_schema = 'public' and table_name = 'auth_audit_log' order by 1`;
    expect(columns.map((column) => column.name)).toEqual(["created_at", "detail", "event", "id", "ip", "user_id"]);
  });

  it("(a) a fixture adding a column fails the allow-list check", async () => {
    const { stack } = await isolated();
    await stack.admin.unsafe("ALTER TABLE public.auth_audit_log ADD COLUMN email text");
    const columns = await stack.admin<{ name: string }[]>`
      select column_name as name from information_schema.columns
      where table_schema = 'public' and table_name = 'auth_audit_log' order by 1`;
    expect(columns.map((column) => column.name)).not.toEqual(["created_at", "detail", "event", "id", "ip", "user_id"]);
  });

  it("(b) PII: ip is the client IP sent, user_id the acting user, a forwarded chain is never stored", async () => {
    const person = await signUp(auth, main.admin);
    await signIn(auth, person.email);
    const chained = await http(auth, "POST", "/sign-in/email", {
      body: { email: person.email, password: PASSWORD },
      headers: { "x-forwarded-for": `198.51.100.7, ${CLIENT_IP}` },
    });
    expect(completed(chained)).toBe(true);
    const rows = await main.admin<{ userId: string; ip: string | null; text: string }[]>`
      select user_id as "userId", ip, row_to_json(a)::text as text from auth_audit_log a where user_id = ${person.id}
      order by created_at`;
    expect(rows.map((row) => row.userId)).toEqual([person.id, person.id]);
    expect(rows[0]?.ip).toBe(CLIENT_IP);
    expect(rows[1]?.ip).not.toContain(",");
    expect(rows[1]?.ip).not.toBe("198.51.100.7");
    for (const row of rows) {
      for (const value of [person.email, NAME, PASSWORD, USER_AGENT, ...secrets]) expect(row.text).not.toContain(value);
    }
  });
});

describe("T14 (R14): the mechanism is exactly what the migrations install, and no runtime role can turn it off", () => {
  it("installs exactly the listed triggers on the system tables", async () => {
    expect(await triggersOn(main.admin, NO_RLS_ALLOW_LIST)).toEqual([...AUTH_AUDIT_TRIGGERS]);
  });

  it("its functions are SECURITY INVOKER plpgsql with a pinned search_path, owned by crm_migrator, executable by no other role", async () => {
    const rows = await main.admin`
      select p.proname as name, l.lanname as language, p.prosecdef as definer, p.proconfig as config,
             pg_get_userbyid(p.proowner) as owner,
             array(select r.rolname from pg_roles r
                   where r.rolname <> pg_get_userbyid(p.proowner) and not r.rolsuper
                     and has_function_privilege(r.oid, p.oid, 'EXECUTE') order by 1) as executors
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.proname like 'auth\\_%' order by 1`;
    expect(rows).toEqual(
      AUTH_AUDIT_FUNCTIONS.map((name) => ({
        name,
        language: "plpgsql",
        definer: false,
        config: ["search_path=pg_catalog, public"],
        owner: "crm_migrator",
        executors: [],
      })),
    );
  });

  it("every disable, replace or bypass attempt as crm_app fails with 42501", async () => {
    const app = postgres(main.appUrl, { max: 1, onnotice: () => {} });
    try {
      for (const statement of [
        "ALTER TABLE public.session DISABLE TRIGGER session_issued_audit",
        "ALTER TABLE public.session DISABLE TRIGGER ALL",
        'ALTER TABLE public."user" DISABLE TRIGGER user_two_factor_changed',
        "DROP TRIGGER session_issued_audit ON public.session",
        "CREATE TRIGGER bypass AFTER INSERT ON public.session FOR EACH ROW EXECUTE FUNCTION public.auth_audit_backup_codes()",
        "CREATE OR REPLACE FUNCTION public.auth_audit_session_issued() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NULL; END'",
        "ALTER FUNCTION public.auth_two_factor_changed() SECURITY DEFINER",
        "DROP FUNCTION public.auth_session_two_factor_check()",
        "SET session_replication_role = replica",
        "UPDATE public.session SET issue_reason = 'password'",
        "UPDATE public.session SET token = token",
        "UPDATE public.session SET user_id = user_id",
        "TRUNCATE public.session",
        "ALTER TABLE public.auth_audit_log DROP CONSTRAINT auth_audit_log_event_check",
      ]) {
        expect(await sqlState(app.unsafe(statement)), statement).toBe("42501");
      }
      // A GRANT without the grant option only warns; it grants nothing.
      await app.unsafe("GRANT INSERT, SELECT ON public.auth_audit_log TO crm_worker");
      const [granted] = await main.admin<{ insert: boolean; select: boolean }[]>`
        select has_table_privilege('crm_worker', 'public.auth_audit_log', 'INSERT') as insert,
               has_table_privilege('crm_worker', 'public.auth_audit_log', 'SELECT') as select`;
      expect(granted).toEqual({ insert: false, select: false });
    } finally {
      await app.end();
    }
  });

  it("no session cookie cache is configured, so no cookie-held session outlives its row", () => {
    expect((auth.options.session as { cookieCache?: unknown } | undefined)?.cookieCache).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// T15: Phase 0 had no issue_reason column; its instance used this session table and connected as the table owner.

const phase0Session = pgTable(
  "session",
  {
    id: uuid("id")
      .default(drizzleSql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => schema.user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

const phase0Schema = {
  user: schema.user,
  session: phase0Session,
  account: schema.account,
  verification: schema.verification,
  twoFactor: schema.twoFactor,
  userRelations: relations(schema.user, ({ many }) => ({
    sessions: many(phase0Session),
    accounts: many(schema.account),
    twoFactors: many(schema.twoFactor),
  })),
  sessionRelations: relations(phase0Session, ({ one }) => ({
    user: one(schema.user, { fields: [phase0Session.userId], references: [schema.user.id] }),
  })),
  accountRelations: schema.accountRelations,
  twoFactorRelations: schema.twoFactorRelations,
};

function phase0Instance(url: string): { auth: AuthLike; end(): Promise<void> } {
  const client = postgres(url, { max: 4, prepare: false, onnotice: () => {} });
  const db = drizzle({ client, schema: phase0Schema });
  const instance = betterAuth({
    appName: "CRM",
    secret: SECRET,
    baseURL: BASE_URL,
    database: drizzleAdapter(db, { provider: "pg", schema: phase0Schema }),
    advanced: { database: { generateId: "uuid" } },
    logger: { level: "error" },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      password: { hash: hashPassword, verify: ({ hash, password }) => verifyPassword(hash, password) },
    },
    plugins: [twoFactorPlugin({ issuer: "CRM" })],
  });
  return { auth: instance, end: () => client.end({ timeout: 1 }) };
}

async function count(admin: postgres.Sql, table: "session" | "auth_audit_log"): Promise<number> {
  const [row] = await admin.unsafe<{ count: number }[]>(`select count(*)::int as count from public.${table}`);
  return row?.count ?? 0;
}

async function migratorWaiting(admin: postgres.Sql): Promise<boolean> {
  const [row] = await admin<{ count: number }[]>`
    select count(*)::int as count from pg_stat_activity
    where datname = current_database() and usename = 'crm_migrator' and wait_event_type = 'Lock'`;
  return (row?.count ?? 0) > 0;
}

const CUTOVER = "LOCK TABLE public.session IN SHARE ROW EXCLUSIVE MODE;\n--> statement-breakpoint\nDELETE FROM public.session;\n--> statement-breakpoint\n";

describe("T15 (R15): Phase 0 sessions are invalidated at cutover", () => {
  it("Phase 0 sessions are invalidated at cutover: no session, no fabricated row, every old cookie refused", async () => {
    const phase0 = await startDatabase({ stopBefore: "0001" });
    const admin = postgres(phase0.adminUrl, { max: 2, onnotice: () => {} });
    const old = phase0Instance(phase0.migratorUrl);
    try {
      const u = await signUp(old.auth, admin);
      const s1 = await signIn(old.auth, u.email);
      const s2 = await signIn(old.auth, u.email);
      const v = await withTwoFactor(old.auth, admin);
      expect((await http(old.auth, "POST", "/sign-out", { jar: v.jar })).status).toBe(200);
      const trusted = await verifyTotp(old.auth, await challenge(old.auth, v.email), v.totp).then(async () => {
        const jar = await challenge(old.auth, v.email);
        return http(old.auth, "POST", "/two-factor/verify-totp", { body: { code: code(v.totp), trustDevice: true }, jar });
      });
      expect(completed(trusted)).toBe(true);
      const trustCookie = trusted.jar.get(TRUST_DEVICE_COOKIE);
      expect(trustCookie).toBeDefined();
      // Old behaviour (T8 from the real Phase 0 point): the trust cookie skips the challenge.
      const skipped = await passwordStep(old.auth, v.email, new CookieJar().update([`${TRUST_DEVICE_COOKIE}=${trustCookie}`]));
      expect(completed(skipped)).toBe(true);
      const renewedTrust = skipped.jar.get(TRUST_DEVICE_COOKIE) ?? trustCookie;
      expect((await http(old.auth, "POST", "/sign-out", { jar: skipped.jar })).status).toBe(200);
      // Keep V's two sessions from the 2FA sign-ins: the first is signed out below, the trusted one is S3.
      const s3 = trusted.jar;
      for (const jar of [s1, s2, s3]) expect(await sessionOf(old.auth, jar)).not.toBeNull();
      const [extra] = await admin<{ count: number }[]>`select count(*)::int as count from session`;
      const kept = [s1, s2, s3].map((jar) => jar.sessionToken);
      await admin`delete from session where not (token = any(${kept as string[]}))`;
      expect(extra?.count).toBeGreaterThanOrEqual(3);
      expect(await count(admin, "session")).toBe(3);

      await phase0.applyRemaining();

      // Before any request to a Phase 1 instance.
      expect(await count(admin, "session")).toBe(0);
      expect(await count(admin, "auth_audit_log")).toBe(0);
      expect(await sessionsWithoutRow(admin)).toEqual([]);
      const [trustRows] = await admin<{ count: number }[]>`
        select count(*)::int as count from verification where identifier like 'trust-device-%'`;
      expect(trustRows?.count).toBe(0);
      const journal = await admin<{ id: number }[]>`select id from drizzle.__drizzle_migrations order by created_at`;
      expect(journal.length).toBeGreaterThanOrEqual(11);

      const handle = await import("../../db/client").then(({ createDb }) => createDb(phase0.appUrl));
      try {
        const phase1 = createAuth({ db: handle.db, secret: SECRET, baseURL: BASE_URL });
        for (const jar of [s1, s2, s3]) {
          const reply = await http(phase1, "GET", "/get-session", { jar });
          expect(reply.body).toBeNull();
          expect(setsSession(reply)).toBe(false);
        }
        expect((await http(phase1, "GET", "/list-sessions", { jar: s1 })).status).toBe(401);
        await signIn(phase1, u.email);
        expect(shape(await auditRows(admin, u.id))).toEqual([LOGIN]);
        // The old trust cookie no longer skips the challenge (R8).
        const withTrust = new CookieJar().update([`${TRUST_DEVICE_COOKIE}=${renewedTrust}`]);
        const jar = await challenge(phase1, v.email, withTrust);
        expect(completed(await verifyTotp(phase1, jar, v.totp))).toBe(true);
        expect(loginRows(await auditRows(admin, v.id))).toHaveLength(1);
        expect(await sessionsWithoutRow(admin)).toEqual([]);
      } finally {
        await handle.sql.end({ timeout: 1 });
      }
    } finally {
      await old.end();
      await admin.end();
      await phase0.stop();
    }
  }, 180_000);

  it("orders the cutover migration before the trusted-device migration", async () => {
    const journal = JSON.parse(
      await import("node:fs/promises").then(({ readFile }) =>
        readFile(new URL("../../../drizzle/meta/_journal.json", import.meta.url), "utf8"),
      ),
    ) as { entries: { idx: number; tag: string }[] };
    const at = (prefix: string) => journal.entries.find((entry) => entry.tag.startsWith(prefix))?.idx ?? -1;
    expect(at("0009")).toBeGreaterThan(-1);
    expect(at("0009")).toBeLessThan(at("0010"));
    const cutover = await import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("../../../drizzle/0009_auth_audit_triggers.sql", import.meta.url), "utf8"),
    );
    // The lock and the delete come before any object of the mechanism.
    expect(cutover.indexOf(CUTOVER)).toBeGreaterThan(-1);
    expect(cutover.indexOf(CUTOVER)).toBeLessThan(cutover.indexOf("CREATE FUNCTION"));
  });

  describe("a concurrent Phase 0 writer", () => {
    let upgrade: TestDatabase;
    beforeAll(async () => {
      upgrade = await startDatabase({ migrate: false });
    }, 120_000);
    afterAll(async () => {
      await upgrade?.stop();
    });

    let databases = 0;
    async function atCutover(): Promise<{ admin: postgres.Sql; app: postgres.Sql; migrate(): Promise<void>; userId: string }> {
      databases += 1;
      const name = `cutover_${databases}`;
      const root = postgres(upgrade.adminUrl, { max: 1, onnotice: () => {} });
      await root.unsafe(`CREATE DATABASE ${name} OWNER crm_migrator`);
      await root.end();
      const { runMigrations } = await import("../../db/migrate");
      const migratorUrl = databaseUrl(upgrade.migratorUrl, name);
      await runMigrations(migratorUrl, await migrationsCopy({ stopBefore: "0009" }));
      const admin = postgres(databaseUrl(upgrade.adminUrl, name), { max: 4, onnotice: () => {} });
      const app = postgres(databaseUrl(upgrade.appUrl, name), { max: 2, onnotice: () => {} });
      const [user] = await admin<{ id: string }[]>`
        insert into "user" (name, email, updated_at) values ('Writer', ${`writer-${name}@example.test`}, now()) returning id`;
      return { admin, app, migrate: () => runMigrations(migratorUrl, MIGRATIONS_DIR), userId: user?.id ?? "" };
    }

    function insertSession(sql: postgres.Sql, userId: string) {
      return sql`insert into session (token, user_id, expires_at, updated_at)
                 values (${`phase0-${Date.now()}-${Math.random()}`}, ${userId}, now() + interval '1 day', now())`;
    }

    it("(1) a write open before the migration's lock: the migration waits, then deletes that session", async () => {
      const { admin, app, migrate, userId } = await atCutover();
      const writer = await app.reserve();
      try {
        await writer`begin`;
        await insertSession(writer, userId);
        const migrating = migrate();
        await waitUntil(() => migratorWaiting(admin), "the migration to wait for the open write");
        await writer`commit`;
        await migrating;
        expect(await count(admin, "session")).toBe(0);
        expect(await count(admin, "auth_audit_log")).toBe(0);
        expect(await sessionsWithoutRow(admin)).toEqual([]);
      } finally {
        writer.release();
        await app.end();
        await admin.end();
      }
    }, 60_000);

    it("(2) a write after the lock is taken: it waits, then fails without its audit row", async () => {
      const { admin, app, migrate, userId } = await atCutover();
      const blocker = await admin.reserve();
      try {
        // Holds the migration after the cutover, at 0010's CREATE TRIGGER on verification.
        await blocker`begin`;
        await blocker`lock table public.verification in row exclusive mode`;
        const migrating = migrate();
        await waitUntil(() => migratorWaiting(admin), "the migration to reach 0010");
        const writing = sqlState(insertSession(app, userId));
        await waitUntil(async () => {
          const [row] = await admin<{ count: number }[]>`
            select count(*)::int as count from pg_stat_activity
            where datname = current_database() and usename = 'crm_app' and wait_event_type = 'Lock'`;
          return (row?.count ?? 0) > 0;
        }, "the write to wait for the migration's lock");
        await blocker`commit`;
        await migrating;
        expect(await writing).toBe("23514");
        expect(await count(admin, "session")).toBe(0);
        expect(await sessionsWithoutRow(admin)).toEqual([]);
      } finally {
        blocker.release();
        await app.end();
        await admin.end();
      }
    }, 60_000);

    it("control: with the cutover statements removed, a Phase 0 session survives without its row", async () => {
      databases += 1;
      const name = `cutover_control_${databases}`;
      const root = postgres(upgrade.adminUrl, { max: 1, onnotice: () => {} });
      await root.unsafe(`CREATE DATABASE ${name} OWNER crm_migrator`);
      await root.end();
      const { runMigrations } = await import("../../db/migrate");
      const migratorUrl = databaseUrl(upgrade.migratorUrl, name);
      await runMigrations(migratorUrl, await migrationsCopy({ stopBefore: "0001" }));
      const admin = postgres(databaseUrl(upgrade.adminUrl, name), { max: 2, onnotice: () => {} });
      const old = phase0Instance(migratorUrl);
      try {
        const u = await signUp(old.auth, admin);
        const s1 = await signIn(old.auth, u.email);
        let edited = false;
        const withoutCutover = await migrationsCopy({
          edit: (tag, text) => {
            if (!tag.startsWith("0009")) return text;
            edited = text.includes(CUTOVER);
            return text.replace(CUTOVER, "");
          },
        });
        expect(edited).toBe(true);
        await runMigrations(migratorUrl, withoutCutover);

        const { createDb } = await import("../../db/client");
        const handle = createDb(databaseUrl(upgrade.appUrl, name));
        try {
          const phase1 = createAuth({ db: handle.db, secret: SECRET, baseURL: BASE_URL });
          expect(await sessionOf(phase1, s1)).not.toBeNull();
          expect(await sessionsWithoutRow(admin)).toHaveLength(1);
        } finally {
          await handle.sql.end({ timeout: 1 });
        }
      } finally {
        await old.end();
        await admin.end();
      }
    }, 60_000);
  });
});

// PR #44 P2-1. Each auth POST holds one pool connection from its first query to commit, including the wait for the
// user's lock (since Round 2 P2-2, the first sign-in of a burst waits for the user row and the rest for its email
// lock). Bound: an unrelated `select 1` on the same pool answers in under 1 000 ms while 30 wrong-password sign-ins
// for one email wait for that user's lock (Bob's probe: 15 ms with 30 emails, 161 ms with one). The row lock is
// held from the admin connection, so without the bound the burst holds every connection until it ends (the control).
describe("PR #44 P2-1: a burst of sign-ins for one email leaves half of the pool to the rest of the app", () => {
  const BURST = 30;
  const BOUND_MS = 1_000;

  // Holds the user's row lock from the admin connection until `release` is called.
  async function holdUser(admin: postgres.Sql, userId: string) {
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => (release = resolve));
    let locked: () => void = () => undefined;
    const isLocked = new Promise<void>((resolve) => (locked = resolve));
    const held = admin.begin(async (tx) => {
      await tx`select 1 from "user" where id = ${userId} for update`;
      locked();
      await released;
    });
    await isLocked;
    return { release, held };
  }

  function wrongPasswords(instance: AuthLike, email: string): Promise<Reply>[] {
    return Array.from({ length: BURST }, () =>
      http(instance, "POST", "/sign-in/email", { body: { email, password: `${PASSWORD} wrong` } }),
    );
  }

  async function settledWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<false>((resolve) => (timer = setTimeout(() => resolve(false), ms)));
    try {
      return await Promise.race([promise.then(() => true), late]);
    } finally {
      clearTimeout(timer);
    }
  }

  it("as configured: at most half of the connections wait for the lock, and select 1 answers within the bound", async () => {
    const { stack, auth } = await isolated();
    const person = await signUp(auth, stack.admin);
    const hold = await holdUser(stack.admin, person.id);
    const replies = wrongPasswords(auth, person.email);
    try {
      // createDb's pool has 10 connections, so 5 request transactions.
      await waitUntil(async () => (await lockWaiters(stack.admin)) === 5, "five sign-ins to wait for the lock");
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(await lockWaiters(stack.admin)).toBe(5);
      // One waits for the user row, the other four for the email lock the first one holds (Round 2 P2-2).
      expect(await signInEmailLockWaiters(stack.admin)).toBe(4);
      const started = performance.now();
      expect(await stack.handle.sql`select 1 as ok`).toEqual([{ ok: 1 }]);
      expect(performance.now() - started).toBeLessThan(BOUND_MS);
    } finally {
      hold.release();
      await hold.held;
    }
    expect((await Promise.all(replies)).map((reply) => reply.status)).toEqual(Array.from({ length: BURST }, () => 401));
  }, 60_000);

  it("control: with as many request transactions as connections, the burst holds the pool and select 1 waits", async () => {
    const { stack } = await isolated();
    const transactions = createAuthTransactions(stack.handle.db, { slots: 10 });
    const unbounded = withRequestTransactions(
      betterAuth(authOptions({ db: stack.handle.db, secret: SECRET, baseURL: BASE_URL, adapterDb: transactions.db })),
      transactions,
    );
    const person = await signUp(unbounded, stack.admin);
    const hold = await holdUser(stack.admin, person.id);
    const replies = wrongPasswords(unbounded, person.email);
    let probe: Promise<unknown> | undefined;
    try {
      await waitUntil(async () => (await lockWaiters(stack.admin)) === 10, "ten sign-ins to wait for the lock");
      probe = stack.handle.sql`select 1 as ok`;
      expect(await settledWithin(probe, BOUND_MS + 500)).toBe(false);
    } finally {
      hold.release();
      await hold.held;
    }
    await probe;
    expect((await Promise.all(replies)).map((reply) => reply.status)).toEqual(Array.from({ length: BURST }, () => 401));
  }, 60_000);
});

// PR #44 Round 2 P2-2 (AUTH-05). Every /sign-in/email request takes a lock on its lower-cased email first, whether
// or not an account has it, so a burst on an unknown email runs one at a time like a burst on a known one, and meets
// the same 5 s lock timeout (500). Bob's probe (wrong-password sign-ins in parallel, no added delay), before the fix:
// 30 known 304 ms total against 94 ms unknown; 80 known 751 ms against 218 ms unknown; all 401.
//
// The signal is not wall time alone. Each request's user lookup (findUserByEmail, after the lock) is wrapped with an
// in-flight counter and a fixed delay of DELAY_MS. Bounds, for both emails: at most one request inside the lookup
// at once; every status 401; total time at least (BURST - 1) × DELAY_MS (a sleep only runs long, so this cannot
// flake low). Relative bound: the unknown burst takes at least half the known burst's time. Without the email lock
// the unknown burst runs 5 at a time (the slot limit): 5 inside the lookup, and about a fifth of the time.
describe("PR #44 Round 2 P2-2 (AUTH-05): a sign-in burst runs one at a time whether or not the email has an account", () => {
  const BURST = 20;
  const DELAY_MS = 20;

  type Burst = { statuses: number[]; maxInFlight: number; totalMs: number };

  async function burst(instance: AuthLike, email: string): Promise<Burst> {
    type Adapter = Record<string, (...args: unknown[]) => Promise<unknown>>;
    const adapter = ((await instance.$context) as { internalAdapter: Adapter }).internalAdapter;
    const original = adapter.findUserByEmail;
    if (!original) throw new Error("no internal adapter method findUserByEmail");
    let inFlight = 0;
    let maxInFlight = 0;
    adapter.findUserByEmail = async (...args: unknown[]) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        return await original.apply(adapter, args);
      } finally {
        inFlight -= 1;
      }
    };
    try {
      const started = performance.now();
      const replies = await Promise.all(
        Array.from({ length: BURST }, () =>
          http(instance, "POST", "/sign-in/email", { body: { email, password: `${PASSWORD} wrong` } }),
        ),
      );
      return { statuses: replies.map((reply) => reply.status), maxInFlight, totalMs: performance.now() - started };
    } finally {
      adapter.findUserByEmail = original;
    }
  }

  // No email in the line: the console is captured, and T13 (c) checks the captured lines.
  function report(label: string, result: Burst): void {
    const total = result.totalMs.toFixed(0);
    process.stdout.write(`[P2-2 burst] ${label}: ${BURST} requests, ${total} ms total, max ${result.maxInFlight} in flight\n`);
  }

  it("known and unknown email: one request at a time, the same status mix, comparable total time", async () => {
    const { stack, auth: instance } = await isolated();
    const person = await signUp(instance, stack.admin);
    const known = await burst(instance, person.email);
    const unknown = await burst(instance, newEmail());
    report("known email", known);
    report("unknown email", unknown);
    for (const result of [known, unknown]) {
      expect(result.statuses).toEqual(Array.from({ length: BURST }, () => 401));
      expect(result.maxInFlight).toBe(1);
      expect(result.totalMs).toBeGreaterThanOrEqual((BURST - 1) * DELAY_MS);
    }
    expect(unknown.totalMs).toBeGreaterThanOrEqual(0.5 * known.totalMs);
  }, 60_000);

  it("the email lock is per email and case-blind: the same email in capitals waits, another email does not", async () => {
    const { stack, auth: instance } = await isolated();
    const email = newEmail();
    const holder = await stack.admin.reserve();
    try {
      await holder`select pg_advisory_lock(${SIGN_IN_EMAIL_LOCK_SPACE}::int, hashtext(${email}))`;
      const waiting = passwordStep(instance, email.toUpperCase());
      await waitUntil(async () => (await signInEmailLockWaiters(stack.admin)) === 1, "the sign-in to wait for its email");
      expect((await passwordStep(instance, newEmail())).status).toBe(401);
      expect(await signInEmailLockWaiters(stack.admin)).toBe(1);
      await holder`select pg_advisory_unlock(${SIGN_IN_EMAIL_LOCK_SPACE}::int, hashtext(${email}))`;
      expect((await waiting).status).toBe(401);
    } finally {
      holder.release();
    }
  }, 30_000);

  it("lock-timeout run: an unknown email waits the same 5 s as a known one and fails the same way (500, no change)", async () => {
    const { stack, auth: instance } = await isolated();
    const person = await signUp(instance, stack.admin);
    const unknownEmail = newEmail();
    const holder = await stack.admin.reserve();
    const timed = async (email: string) => {
      const started = Date.now();
      const reply = await passwordStep(instance, email);
      return { reply, elapsed: Date.now() - started };
    };
    try {
      await holder`begin`;
      // The known email waits for its user row (as in T6's lock-timeout run); the unknown one for its email lock.
      await holder`select id from "user" where id = ${person.id} for update`;
      await holder`select pg_advisory_xact_lock(${SIGN_IN_EMAIL_LOCK_SPACE}::int, hashtext(${unknownEmail}))`;
      const before = logged.filter((line) => line.includes("(55P03)")).length;
      const [known, unknown] = await Promise.all([timed(person.email), timed(unknownEmail)]);
      for (const { reply, elapsed } of [known, unknown]) {
        expect(reply.status).toBe(500);
        expectFailedWithoutSession(reply);
        expect(elapsed).toBeGreaterThanOrEqual(4_500);
      }
      expect(logged.filter((line) => line.includes("(55P03)")).length - before).toBe(2);
    } finally {
      await holder`rollback`;
      holder.release();
    }
    expect(await sessionTokens(stack.admin, person.id)).toEqual([]);
    expect(await auditRows(stack.admin, person.id)).toEqual([]);
  }, 30_000);
});

describe("T13 (R13): logs", () => {
  it("(c) the captured logs of every failure and race in this file hold no token, code, secret, email, user agent or client IP", () => {
    expect(logged.length).toBeGreaterThan(0);
    const leaks = [...secrets, CLIENT_IP].filter((secret) => logged.some((line) => line.includes(secret)));
    expect(leaks).toEqual([]);
  });
});

// Keep the cookie names used by the helpers in one place (the challenge cookie is read in T6 and T7 via the jar).
void TWO_FACTOR_COOKIE;
