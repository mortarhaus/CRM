import { AUTH_DEFAULT_LIMIT, SIGN_IN_ACCOUNT_FAILURE_LIMIT, SIGN_IN_IP_LIMIT } from "@crm/core/security";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../../db/client";
import { BASE_URL, CookieJar, PASSWORD, SECRET } from "../../test/auth-harness";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { totpFromUri, wrongTotpCode } from "../../test/totp";
import { createAuth } from "./config";
import {
  accountKeyHmacKey,
  accountKeyOf,
  authRequestHandler,
  TOO_MANY_REQUESTS_BODY,
  UNREADABLE_SIGN_IN_KEY,
} from "./request-handler";

// Plan Task 23 Steps 2 and 3, in process against a real Better Auth 1.7.14 and the limiter pool. The same rows across
// two `next start` processes, the form path and the edge are in rate-limit.test.ts.

let database: TestDatabase;
let admin: postgres.Sql;
let app: DbHandle;
let limiter: DbHandle;
let handle: (request: Request) => Promise<Response>;
// Requests that reached Better Auth's handler.
let reachedBetterAuth = 0;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  app = createDb(database.appUrl);
  limiter = createDb(database.appUrl, { max: 2 });
  const auth = createAuth({ db: app.db, limiterDb: limiter.db, secret: SECRET, baseURL: BASE_URL });
  handle = authRequestHandler({
    handler: (request) => {
      reachedBetterAuth += 1;
      return auth.handler(request);
    },
    limiterDb: limiter.db,
    secret: SECRET,
  });
});

afterAll(async () => {
  await app?.sql.end();
  await limiter?.sql.end();
  await admin?.end();
  await database?.stop();
});

beforeEach(async () => {
  await admin`delete from rate_limit`;
});

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `limit${counter}-${Date.now()}@example.test`;
}

// Each request from its own address unless a test names one, so only the account row is reached.
function nextIp(): string {
  counter += 1;
  return `198.51.100.${(counter % 250) + 1}`;
}

function post(path: string, body: unknown, ip = nextIp(), jar?: CookieJar): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", origin: BASE_URL, "x-crm-client-ip": ip });
  if (jar) headers.set("cookie", jar.header());
  return handle(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

// A request that keeps the jar's cookies up to date.
async function postWith(jar: CookieJar, path: string, body: unknown): Promise<Response> {
  const response = await post(path, body, nextIp(), jar);
  jar.update(response.headers.getSetCookie());
  return response;
}

const signIn = (email: string, password: string, ip?: string) => post("/sign-in/email", { email, password }, ip);

async function signUp(email: string): Promise<void> {
  const response = await post("/sign-up/email", { name: "Limit Person", email, password: PASSWORD });
  expect(response.status).toBe(200);
}

async function expectUniform429(response: Response): Promise<void> {
  expect(response.status).toBe(429);
  expect(await response.text()).toBe(TOO_MANY_REQUESTS_BODY);
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const retryAfter = response.headers.get("retry-after");
  expect(retryAfter).toMatch(/^[1-9]\d*$/);
  expect(response.headers.get("x-retry-after")).toBe(retryAfter);
}

async function statuses(responses: Promise<Response>[]): Promise<number[]> {
  return (await Promise.all(responses)).map((response) => response.status);
}

describe("sign-in failures per account (5 per 15 minutes)", () => {
  const { max } = SIGN_IN_ACCOUNT_FAILURE_LIMIT;

  it("refuses the sixth failure, then the right password too, with the uniform 429", async () => {
    const email = uniqueEmail();
    await signUp(email);
    for (let i = 0; i < max; i += 1) expect((await signIn(email, `${PASSWORD} wrong`)).status).toBe(401);
    await expectUniform429(await signIn(email, `${PASSWORD} wrong`));
    await expectUniform429(await signIn(email, PASSWORD));
  });

  it("counts an unknown email exactly like a known one, and the 429 bodies are byte-identical", async () => {
    const known = uniqueEmail();
    const unknown = uniqueEmail();
    await signUp(known);
    for (let i = 0; i < max; i += 1) {
      expect((await signIn(known, `${PASSWORD} wrong`)).status).toBe(401);
      expect((await signIn(unknown, `${PASSWORD} wrong`)).status).toBe(401);
    }
    const [a, b] = await Promise.all([signIn(known, PASSWORD), signIn(unknown, PASSWORD)]);
    expect([a?.status, b?.status]).toEqual([429, 429]);
    expect(await a?.text()).toBe(await b?.text());
  });

  it("keys the normalized email: case, surrounding space and Unicode form share one counter", async () => {
    const email = uniqueEmail();
    const forms = [email, ` ${email.toUpperCase()} `, `\t${email}`, email.replace("limit", "LIMIT"), email];
    // Better Auth answers 400 to an email with surrounding space; it is still a failure on that account.
    for (const form of forms) expect([400, 401]).toContain((await signIn(form, `${PASSWORD} wrong`)).status);
    await expectUniform429(await signIn(email, PASSWORD));
    const hmacKey = accountKeyHmacKey(SECRET);
    expect(accountKeyOf(hmacKey, "Café@example.test")).toBe(accountKeyOf(hmacKey, "café@example.test"));
  });

  it("does not count a successful sign-in", async () => {
    const email = uniqueEmail();
    await signUp(email);
    for (let i = 0; i < max - 1; i += 1) expect((await signIn(email, `${PASSWORD} wrong`)).status).toBe(401);
    for (let i = 0; i < 3; i += 1) expect((await signIn(email, PASSWORD)).status).toBe(200);
    expect((await signIn(email, `${PASSWORD} wrong`)).status).toBe(401);
    await expectUniform429(await signIn(email, `${PASSWORD} wrong`));
  });

  it("lets exactly the cap through when the failures arrive at once", async () => {
    const email = uniqueEmail();
    const replies = await statuses(Array.from({ length: 20 }, () => signIn(email, `${PASSWORD} wrong`)));
    expect(replies.filter((status) => status === 401)).toHaveLength(max);
    expect(replies.filter((status) => status === 429)).toHaveLength(20 - max);
  });

  it("stores no email: the key is an HMAC of the normalized email", async () => {
    const email = uniqueEmail();
    await signIn(email, `${PASSWORD} wrong`);
    const keys = (await admin<{ key: string }[]>`select key from rate_limit`).map((row) => row.key);
    expect(keys).toContain(accountKeyOf(accountKeyHmacKey(SECRET), email));
    expect(keys.join(" ")).not.toContain(email.split("@")[0]);
    expect(keys.filter((key) => key.startsWith("acct:signin:"))).toEqual([
      expect.stringMatching(/^acct:signin:[A-Za-z0-9_-]{43}$/),
    ]);
  });

});

// Security scan finding (2026-11-01, HIGH, parser differential): a sign-in whose email this layer could not read
// skipped the account count while Better Auth might still read it. Now the layer refuses every media type Better Auth
// would refuse (415, before Better Auth runs), and counts a JSON body it cannot read on one shared key.
describe("sign-in bodies the account key cannot read: fail closed", () => {
  function raw(body: BodyInit, contentType: string | null, ip = nextIp()): Promise<Response> {
    const headers = new Headers({ origin: BASE_URL, "x-crm-client-ip": ip });
    if (contentType !== null) headers.set("content-type", contentType);
    return handle(new Request(`${BASE_URL}/api/auth/sign-in/email`, { method: "POST", headers, body }));
  }

  async function accountCount(key: string): Promise<number | undefined> {
    const [row] = await admin<{ count: number }[]>`select count from rate_limit where key = ${key}`;
    return row?.count;
  }

  it.each([
    ["urlencoded", () => new URLSearchParams({ email: "x@example.test", password: PASSWORD }), "application/x-www-form-urlencoded"],
    ["multipart", () => Object.assign(new FormData(), {}), "multipart/form-data; boundary=----x"],
    ["text/plain", () => JSON.stringify({ email: "x@example.test", password: PASSWORD }), "text/plain"],
    ["no Content-Type", () => JSON.stringify({ email: "x@example.test", password: PASSWORD }), null],
    ["a JSON suffix type", () => JSON.stringify({ email: "x@example.test", password: PASSWORD }), "application/vnd.api+json"],
  ] as const)("refuses %s with 415 before Better Auth runs", async (_label, body, contentType) => {
    const before = reachedBetterAuth;
    const response = await raw(body() as BodyInit, contentType);
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
    expect(reachedBetterAuth).toBe(before);
  });

  it("refuses a multipart body that carries the fields too", async () => {
    const form = new FormData();
    form.set("email", "x@example.test");
    form.set("password", PASSWORD);
    const before = reachedBetterAuth;
    expect((await handle(new Request(`${BASE_URL}/api/auth/sign-in/email`, { method: "POST", headers: { origin: BASE_URL }, body: form }))).status).toBe(415);
    expect(reachedBetterAuth).toBe(before);
  });

  it.each([
    ["malformed JSON", "{\"email\": "],
    ["a JSON string", JSON.stringify("x@example.test")],
    ["a non-string email", JSON.stringify({ email: 42, password: PASSWORD })],
    ["no email", JSON.stringify({ password: PASSWORD })],
  ])("counts %s on the shared unreadable-body key, and Better Auth answers 400", async (_label, body) => {
    const before = (await accountCount(UNREADABLE_SIGN_IN_KEY)) ?? 0;
    expect((await raw(body, "application/json")).status).toBe(400);
    expect(await accountCount(UNREADABLE_SIGN_IN_KEY)).toBe(before + 1);
  });

  it("counts JSON with charset, upper-case type, and a cased or padded email on the same account key as plain JSON", async () => {
    const email = uniqueEmail();
    const key = accountKeyOf(accountKeyHmacKey(SECRET), email);
    const body = (value: string) => JSON.stringify({ email: value, password: `${PASSWORD} wrong` });
    await raw(body(email), "application/json");
    await raw(body(email.toUpperCase()), "application/json; charset=utf-8");
    await raw(body(`  ${email}  `), "Application/JSON");
    await raw(body(email.replace("limit", "LiMiT")), "application/json;charset=UTF-8");
    expect(await accountCount(key)).toBe(4);
    expect(await accountCount(UNREADABLE_SIGN_IN_KEY)).toBeUndefined();
  });
});

describe("the uniform 429", () => {
  it("rebuilds Better Auth's own 429 (the sign-in row per IP)", async () => {
    const ip = "203.0.113.50";
    const replies = await statuses(
      Array.from({ length: SIGN_IN_IP_LIMIT.max }, () => signIn(uniqueEmail(), `${PASSWORD} wrong`, ip)),
    );
    expect(replies.every((status) => status === 401)).toBe(true);
    const refused = await signIn(uniqueEmail(), `${PASSWORD} wrong`, ip);
    await expectUniform429(refused);
    expect(Number(refused.headers.get("retry-after"))).toBeLessThanOrEqual(SIGN_IN_IP_LIMIT.windowSeconds);
  });

  it("gives a 429 without a retry time the default window, and leaves other answers alone", async () => {
    const fake = (response: Response) =>
      authRequestHandler({ handler: async () => response, limiterDb: limiter.db, secret: SECRET });
    const request = () => new Request(`${BASE_URL}/api/auth/get-session`);
    const locked = await fake(Response.json({ code: "ACCOUNT_TEMPORARILY_LOCKED" }, { status: 429 }))(request());
    await expectUniform429(locked);
    expect(locked.headers.get("retry-after")).toBe(String(AUTH_DEFAULT_LIMIT.windowSeconds));
    const ok = await fake(Response.json({ ok: true }, { status: 200, headers: { "x-test": "kept" } }))(request());
    expect(ok.headers.get("x-test")).toBe("kept");
    expect(await ok.json()).toEqual({ ok: true });
  });
});

// Better Auth 1.7.14's two-factor limits are kept as they are (plan Task 23 Step 4; plugins/two-factor/
// totp/index.mjs:150 and verify-two-factor.mjs:118-133): 5 codes per challenge, then 10 failures in a row lock the
// account for 900 s. Each request comes from its own address, so the per-IP rows stay out of the way.
describe("two-factor lockout defaults, unchanged", () => {
  it("5 codes per challenge; the tenth failure locks, and even the right code then gets the uniform 429", async () => {
    const email = uniqueEmail();
    await signUp(email);
    const owner = new CookieJar();
    expect((await postWith(owner, "/sign-in/email", { email, password: PASSWORD })).status).toBe(200);
    const enrolment = await postWith(owner, "/two-factor/enable", { password: PASSWORD });
    const { totpURI } = (await enrolment.json()) as { totpURI: string };
    const totp = totpFromUri(totpURI);
    expect((await postWith(owner, "/two-factor/verify-totp", { code: totp.generate() })).status).toBe(200);

    async function challenge(): Promise<CookieJar> {
      const jar = new CookieJar();
      const reply = await postWith(jar, "/sign-in/email", { email, password: PASSWORD });
      expect(reply.status).toBe(200);
      expect(await reply.json()).toMatchObject({ twoFactorRedirect: true });
      return jar;
    }
    const wrong = (jar: CookieJar) => postWith(jar, "/two-factor/verify-totp", { code: wrongTotpCode(totp) });

    const first = await challenge();
    for (let i = 0; i < 5; i += 1) expect((await wrong(first)).status).toBe(401);
    const sixth = await wrong(first);
    expect(sixth.status).toBe(400);
    expect(await sixth.json()).toMatchObject({ code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" });

    const second = await challenge();
    for (let i = 0; i < 5; i += 1) expect((await wrong(second)).status).toBe(401);
    const third = await challenge();
    await expectUniform429(await postWith(third, "/two-factor/verify-totp", { code: totp.generate() }));
    const [row] = await admin<{ lockedUntil: Date }[]>`
      select t.locked_until as "lockedUntil" from two_factor t join "user" u on u.id = t.user_id where u.email = ${email}`;
    const lockSeconds = ((row?.lockedUntil.getTime() ?? 0) - Date.now()) / 1000;
    expect(lockSeconds).toBeGreaterThan(890);
    expect(lockSeconds).toBeLessThanOrEqual(900);
  });
});
