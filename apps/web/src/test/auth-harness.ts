import postgres from "postgres";
import { createDb, type DbHandle } from "../db/client";
import { SIGN_IN_EMAIL_LOCK_SPACE } from "../db/system";
import { databaseUrl, type TestDatabase } from "./postgres";

// Test-only tools for plan Task 31 (auth-audit.test.ts): HTTP calls with a cookie jar, database fixtures that
// fail or hold one chosen statement, pauses inside Better Auth's internal adapter, and state reads as the admin.

export const SECRET = "integration test secret, not a real key";
export const BASE_URL = "http://localhost:3000";
export const PASSWORD = "correct horse battery staple 42";
export const CLIENT_IP = "203.0.113.9";
export const USER_AGENT = "auth-audit-test/1.0 (device under test)";
export const SESSION_COOKIE = "better-auth.session_token";
export const TWO_FACTOR_COOKIE = "better-auth.two_factor";
export const TRUST_DEVICE_COOKIE = "better-auth.trust_device";

// What the helpers need of a Better Auth instance: the configured one and the test-only controls alike.
export interface AuthLike {
  handler(request: Request): Promise<Response>;
  $context: Promise<unknown>;
}

export class CookieJar {
  private readonly values = new Map<string, string>();

  constructor(from?: CookieJar) {
    if (from) for (const [name, value] of from.values) this.values.set(name, value);
  }

  update(setCookies: readonly string[]): this {
    for (const line of setCookies) {
      const [pair = "", ...attributes] = line.split(";");
      const at = pair.indexOf("=");
      const name = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      const expired = value === "" || attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
      if (expired) this.values.delete(name);
      else this.values.set(name, value);
    }
    return this;
  }

  get(name: string): string | undefined {
    return this.values.get(name);
  }

  without(name: string): CookieJar {
    const copy = new CookieJar(this);
    copy.values.delete(name);
    return copy;
  }

  // The session token inside the signed session cookie ("<token>.<signature>").
  get sessionToken(): string | undefined {
    const value = this.values.get(SESSION_COOKIE);
    return value === undefined ? undefined : (decodeURIComponent(value).split(".")[0] ?? undefined);
  }

  header(): string {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  headers(extra: HeadersInit = {}): Headers {
    const headers = new Headers(extra);
    headers.set("x-crm-client-ip", CLIENT_IP);
    headers.set("user-agent", USER_AGENT);
    if (this.values.size > 0) headers.set("cookie", this.header());
    return headers;
  }
}

export interface Reply {
  status: number;
  // Raw controls rethrow a database error out of the handler (onAPIError.throw); a configured instance never does.
  thrown: boolean;
  body: unknown;
  setCookies: string[];
  jar: CookieJar;
}

export async function call(
  auth: AuthLike,
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; jar?: CookieJar; headers?: HeadersInit } = {},
): Promise<Reply> {
  const jar = new CookieJar(options.jar);
  const headers = jar.headers(options.headers);
  headers.set("origin", BASE_URL);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      }),
    );
  } catch {
    return { status: 500, thrown: true, body: null, setCookies: [], jar };
  }
  const setCookies = response.headers.getSetCookie();
  const text = await response.text();
  let body: unknown;
  try {
    body = text === "" ? null : JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, thrown: false, body, setCookies, jar: jar.update(setCookies) };
}

// Whether a response sets a non-empty session cookie.
export function setsSession(reply: Reply): boolean {
  return reply.setCookies.some((line) => {
    const pair = line.split(";")[0] ?? "";
    return pair.startsWith(`${SESSION_COOKIE}=`) && pair.length > SESSION_COOKIE.length + 1;
  });
}

export function bodyField(reply: Reply, field: string): unknown {
  return typeof reply.body === "object" && reply.body !== null ? (reply.body as Record<string, unknown>)[field] : undefined;
}

// One database of the test container, as the admin (state reads, fixtures) and as crm_app (the instance).
export interface Stack {
  name: string;
  admin: postgres.Sql;
  handle: DbHandle;
  appUrl: string;
  close(): Promise<void>;
}

export function openStack(database: TestDatabase, name: string): Stack {
  const admin = postgres(databaseUrl(database.adminUrl, name), { max: 4, onnotice: () => {} });
  const appUrl = databaseUrl(database.appUrl, name);
  const handle = createDb(appUrl);
  return {
    name,
    admin,
    handle,
    appUrl,
    async close() {
      await handle.sql.end({ timeout: 1 });
      await admin.end({ timeout: 1 });
    },
  };
}

// A database of its own, copied from a template database that nothing is connected to.
export async function cloneStack(database: TestDatabase, template: string, name: string): Promise<Stack> {
  const root = postgres(databaseUrl(database.adminUrl, "postgres"), { max: 1, onnotice: () => {} });
  try {
    await root.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${template}" OWNER crm_migrator`);
  } finally {
    await root.end();
  }
  return openStack(database, name);
}

export async function waitUntil(check: () => Promise<boolean>, what: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Backends of crm_app in this database waiting for a row or transaction lock, or for a sign-in email lock
// (lockAuthUsers), but not for a test hold (a single-bigint advisory key).
export async function lockWaiters(admin: postgres.Sql): Promise<number> {
  const [row] = await admin<{ count: number }[]>`
    select count(distinct a.pid)::int as count from pg_stat_activity a join pg_locks l on l.pid = a.pid
    where a.datname = current_database() and a.usename = 'crm_app' and not l.granted
      and (l.locktype <> 'advisory' or (l.objsubid = 2 and l.classid = ${SIGN_IN_EMAIL_LOCK_SPACE}::oid))`;
  return row?.count ?? 0;
}

// Backends of crm_app in this database waiting for a sign-in email lock only.
export async function signInEmailLockWaiters(admin: postgres.Sql): Promise<number> {
  const [row] = await admin<{ count: number }[]>`
    select count(distinct a.pid)::int as count from pg_stat_activity a join pg_locks l on l.pid = a.pid
    where a.datname = current_database() and a.usename = 'crm_app' and not l.granted
      and l.locktype = 'advisory' and l.objsubid = 2 and l.classid = ${SIGN_IN_EMAIL_LOCK_SPACE}::oid`;
  return row?.count ?? 0;
}

const FIXTURES = `
  CREATE SCHEMA IF NOT EXISTS test_fixture;
  CREATE OR REPLACE FUNCTION test_fixture.hold() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    PERFORM pg_advisory_xact_lock(TG_ARGV[0]::bigint);
    RETURN coalesce(NEW, OLD);
  END $$;
  CREATE OR REPLACE FUNCTION test_fixture.fail_once() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    IF nextval('test_fixture.' || quote_ident(TG_ARGV[0])) = 1 THEN
      RAISE EXCEPTION 'test fault' USING ERRCODE = TG_ARGV[1];
    END IF;
    RETURN coalesce(NEW, OLD);
  END $$;
`;

export interface FixturePoint {
  // e.g. `BEFORE INSERT ON public.session`, `BEFORE UPDATE OF verified ON public.two_factor`
  on: string;
  when?: string;
  // Trigger name order: BEFORE triggers fire by name, so "aaa_" runs before the mechanism's own triggers.
  name?: string;
}

let fixtureCounter = 0;

function triggerSql(point: FixturePoint, name: string, call: string): string {
  const when = point.when ? `WHEN (${point.when})` : "";
  return `CREATE TRIGGER ${name} ${point.on} FOR EACH ROW ${when} EXECUTE FUNCTION ${call}`;
}

// The statement at this point fails once with the given SQLSTATE (42501: a refused audit write).
export async function failOnce(admin: postgres.Sql, point: FixturePoint, sqlState = "42501"): Promise<void> {
  fixtureCounter += 1;
  const name = point.name ?? `aaa_test_fault_${fixtureCounter}`;
  await admin.unsafe(FIXTURES);
  await admin.unsafe(`CREATE SEQUENCE test_fixture.${name}`);
  await admin.unsafe(triggerSql(point, name, `test_fixture.fail_once('${name}', '${sqlState}')`));
}

export interface Hold {
  // Resolves once a backend waits at the point.
  reached(): Promise<void>;
  release(): Promise<void>;
  // Terminates the backend waiting at the point (a connection death inside the statement).
  kill(): Promise<void>;
}

// The statement at this point waits until release() or kill().
export async function holdAt(admin: postgres.Sql, point: FixturePoint): Promise<Hold> {
  fixtureCounter += 1;
  const key = 7_000_000 + fixtureCounter;
  const name = point.name ?? `aaa_test_hold_${fixtureCounter}`;
  await admin.unsafe(FIXTURES);
  await admin.unsafe(triggerSql(point, name, `test_fixture.hold('${key}')`));
  const holder = await admin.reserve();
  await holder`select pg_advisory_lock(${key})`;
  const waiting = async () => {
    const rows = await admin<{ pid: number }[]>`
      select l.pid from pg_locks l join pg_stat_activity a on a.pid = l.pid
      where l.locktype = 'advisory' and l.objsubid = 1 and not l.granted and l.objid = ${key}
        and a.datname = current_database()`;
    return rows.map((row) => row.pid);
  };
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await holder`select pg_advisory_unlock(${key})`;
    holder.release();
  };
  return {
    reached: () => waitUntil(async () => (await waiting()).length > 0, `a backend at ${point.on}`),
    release,
    async kill() {
      const pids = await waiting();
      if (pids.length !== 1) throw new Error(`expected one backend at ${point.on}, found ${pids.length}`);
      await admin`select pg_terminate_backend(${pids[0] ?? 0})`;
      await release();
    },
  };
}

export interface Pause {
  reached: Promise<void>;
  release(): void;
  restore(): void;
}

// Pauses the next matching call of one of Better Auth's internal adapter methods, before it runs.
export async function pauseAdapter(
  auth: AuthLike,
  method: string,
  matches: (...args: unknown[]) => boolean = () => true,
): Promise<Pause> {
  const context = (await auth.$context) as { internalAdapter: Record<string, (...args: unknown[]) => Promise<unknown>> };
  const adapter = context.internalAdapter;
  const original = adapter[method];
  if (!original) throw new Error(`no internal adapter method ${method}`);
  let reach!: () => void;
  let release!: () => void;
  const reached = new Promise<void>((resolve) => (reach = resolve));
  const released = new Promise<void>((resolve) => (release = resolve));
  let armed = true;
  adapter[method] = async (...args: unknown[]) => {
    if (armed && matches(...args)) {
      armed = false;
      reach();
      await released;
    }
    return original.apply(adapter, args);
  };
  return {
    reached,
    release,
    restore: () => {
      adapter[method] = original;
    },
  };
}

export interface AuditRow {
  userId: string;
  event: string;
  detail: Record<string, unknown> | null;
  ip: string | null;
}

// A user's rows in the order they were written (within one statement, the 2FA step before the session).
export async function auditRows(admin: postgres.Sql, userId: string): Promise<AuditRow[]> {
  const rows = await admin<AuditRow[]>`
    select user_id as "userId", event, detail, ip from auth_audit_log where user_id = ${userId}
    order by created_at, case event when 'two_factor_verified' then 0 else 1 end`;
  return [...rows];
}

export async function sessionTokens(admin: postgres.Sql, userId: string): Promise<string[]> {
  const rows = await admin<{ token: string }[]>`select token from session where user_id = ${userId} order by created_at`;
  return rows.map((row) => row.token);
}

// The session invariant (plan Task 31 R2): every session row has its session_issued row.
export async function sessionsWithoutRow(admin: postgres.Sql): Promise<string[]> {
  const rows = await admin<{ id: string }[]>`
    select s.id from session s
    where not exists (select 1 from auth_audit_log a
                      where a.event = 'session_issued' and a.detail ->> 'session_id' = s.id::text)`;
  return rows.map((row) => row.id);
}

export async function userIdOf(admin: postgres.Sql, email: string): Promise<string> {
  const [row] = await admin<{ id: string }[]>`select id from "user" where email = ${email}`;
  if (!row) throw new Error(`no user ${email}`);
  return row.id;
}

export interface TwoFactorState {
  enabled: boolean | null;
  row: { secret: string; backupCodes: string; verified: boolean | null } | null;
}

export async function twoFactorState(admin: postgres.Sql, userId: string): Promise<TwoFactorState> {
  const [account] = await admin<{ enabled: boolean | null }[]>`
    select two_factor_enabled as enabled from "user" where id = ${userId}`;
  const [row] = await admin<{ secret: string; backupCodes: string; verified: boolean | null }[]>`
    select secret, backup_codes as "backupCodes", verified from two_factor where user_id = ${userId}`;
  return { enabled: account?.enabled ?? null, row: row ?? null };
}
