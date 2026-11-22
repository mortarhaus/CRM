import {
  AUTH_DEFAULT_LIMIT,
  PASSWORD_CHECK_IP_LIMIT,
  SIGN_IN_ACCOUNT_FAILURE_LIMIT,
  SIGN_IN_IP_LIMIT,
  SIGN_UP_IP_LIMIT,
  TWO_FACTOR_VERIFY_IP_LIMIT,
} from "@crm/core/security";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PASSWORD, SECRET } from "../../test/auth-harness";
import {
  buildWeb,
  EDGE_BACKEND_HEADER,
  EDGE_MODE_HEADER,
  EDGE_PEER_HEADER,
  type EdgeMode,
  startEdge,
  startNext,
  type TestEdge,
} from "../../test/next-server";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { TOO_MANY_ATTEMPTS } from "./messages";
import { PLACEHOLDER_CLIENT_IP } from "./client-ip";
import { TOO_MANY_REQUESTS_BODY } from "./request-handler";

// Plan Task 23 Step 4: the built app (`next start`, two processes on one database) behind a test edge, once per
// trusted-header setting. The per-account key, the 429 shape and the two-factor lockout are also covered in process
// (request-handler.test.ts).

const TRUSTED_HEADERS = ["cf-connecting-ip", "x-forwarded-for"] as const;
const TEST_TIMEOUT = 120_000;

let database: TestDatabase;
let admin: postgres.Sql;

beforeAll(async () => {
  await buildWeb();
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
}, 300_000);

afterAll(async () => {
  await admin?.end();
  await database?.stop();
});

let counter = 0;
function unique(): number {
  counter += 1;
  return counter;
}
const uniqueEmail = () => `edge${unique()}-${Date.now()}@example.test`;
// TEST-NET-3 addresses: one per test (the peer the edge sees), and rotating forged values.
const peer = () => `203.0.113.${(unique() % 250) + 1}`;
const forged = () => `198.51.100.${(unique() % 250) + 1}`;

async function count(key: string): Promise<number | undefined> {
  const [row] = await admin<{ count: number }[]>`select count from rate_limit where key = ${key}`;
  return row?.count;
}

describe.each(TRUSTED_HEADERS)("behind an edge that sets %s", (trustedHeader) => {
  let edge: TestEdge;
  let env: Record<string, string>;
  let actionFields: [string, string][];

  beforeAll(async () => {
    edge = await startEdge(trustedHeader, []);
    env = {
      DATABASE_URL: database.appUrl,
      DATABASE_MIGRATOR_URL: database.migratorUrl,
      AUTH_SECRET: SECRET,
      APP_URL: edge.origin,
      DEPLOYMENT_MODE: "selfhost",
      TRUSTED_CLIENT_IP_HEADER: trustedHeader,
    };
    edge.backends.push(...(await Promise.all([startNext(env), startNext(env)])));
    // The sign-in form's server-action fields, as a browser without JavaScript posts them (same build, both processes).
    const html = await (await fetch(`${edge.origin}/sign-in`)).text();
    actionFields = [...html.matchAll(/<input[^>]*name="(\$ACTION[^"]*)"(?:[^>]*value="([^"]*)")?/g)].map((match) => [
      match[1] ?? "",
      (match[2] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
    ]);
    expect(actionFields.length).toBeGreaterThan(0);
  }, 180_000);

  afterAll(async () => {
    await Promise.all(edge?.backends.map((server) => server.stop()) ?? []);
    await edge?.close();
  });

  beforeEach(async () => {
    await admin`delete from rate_limit`;
  });

  interface Via {
    peer: string;
    backend?: number;
    mode?: EdgeMode;
    headers?: Record<string, string>;
    cookie?: string;
  }

  function edgeHeaders(via: Via): Headers {
    const headers = new Headers(via.headers);
    headers.set(EDGE_PEER_HEADER, via.peer);
    headers.set(EDGE_BACKEND_HEADER, String(via.backend ?? 0));
    headers.set(EDGE_MODE_HEADER, via.mode ?? "set");
    headers.set("origin", edge.origin);
    if (via.cookie) headers.set("cookie", via.cookie);
    return headers;
  }

  function api(path: string, via: Via, body?: unknown): Promise<Response> {
    const headers = edgeHeaders(via);
    if (body !== undefined) headers.set("content-type", "application/json");
    return fetch(`${edge.origin}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  }

  const signIn = (email: string, password: string, via: Via) => api("/sign-in/email", via, { email, password });

  // The sign-in form (server action → postToAuth). "limited" is the Phase 0 message for any 429.
  async function formSignIn(email: string, password: string, via: Via): Promise<"signed-in" | "failed" | "limited"> {
    const form = new FormData();
    for (const [name, value] of actionFields) form.set(name, value);
    form.set("email", email);
    form.set("password", password);
    const response = await fetch(`${edge.origin}/sign-in`, { method: "POST", headers: edgeHeaders(via), body: form, redirect: "manual" });
    if (response.status === 303) return "signed-in";
    const html = await response.text();
    expect(response.status).toBe(200);
    return html.includes(TOO_MANY_ATTEMPTS) ? "limited" : "failed";
  }

  async function expectUniform429(response: Response): Promise<void> {
    expect(response.status).toBe(429);
    expect(await response.text()).toBe(TOO_MANY_REQUESTS_BODY);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toMatch(/^[1-9]\d*$/);
    expect(response.headers.get("x-retry-after")).toBe(response.headers.get("retry-after"));
  }

  async function signUp(email: string, via: Via): Promise<Response> {
    return api("/sign-up/email", via, { name: "Edge Person", email, password: PASSWORD });
  }

  describe("each Phase 1 row: the allowed number passes, the next gets the uniform 429", () => {
    it(
      "default row (any other path): 100 per minute per IP, across both processes",
      async () => {
        const via = { peer: peer() };
        for (let i = 0; i < AUTH_DEFAULT_LIMIT.max; i += 1) {
          expect((await api("/get-session", { ...via, backend: i % 2 })).status).toBe(200);
        }
        await expectUniform429(await api("/get-session", via));
      },
      TEST_TIMEOUT,
    );

    it(
      "sign-in per IP: 10 per minute",
      async () => {
        const via = { peer: peer() };
        for (let i = 0; i < SIGN_IN_IP_LIMIT.max; i += 1) {
          expect((await signIn(uniqueEmail(), `${PASSWORD} wrong`, { ...via, backend: i % 2 })).status).toBe(401);
        }
        await expectUniform429(await signIn(uniqueEmail(), PASSWORD, via));
      },
      TEST_TIMEOUT,
    );

    it(
      "sign-in failures per account: 5 per 15 minutes, a known and an unknown email alike, byte-identical 429",
      async () => {
        const known = uniqueEmail();
        const unknown = uniqueEmail();
        expect((await signUp(known, { peer: peer() })).status).toBe(200);
        for (let i = 0; i < SIGN_IN_ACCOUNT_FAILURE_LIMIT.max; i += 1) {
          expect((await signIn(known, `${PASSWORD} wrong`, { peer: peer(), backend: i % 2 })).status).toBe(401);
          expect((await signIn(unknown, `${PASSWORD} wrong`, { peer: peer(), backend: i % 2 })).status).toBe(401);
        }
        const [a, b] = await Promise.all([signIn(known, PASSWORD, { peer: peer() }), signIn(unknown, PASSWORD, { peer: peer() })]);
        await expectUniform429(a as Response);
        await expectUniform429(b as Response);
      },
      TEST_TIMEOUT,
    );

    it(
      "a successful sign-in does not count toward the account cap",
      async () => {
        const email = uniqueEmail();
        expect((await signUp(email, { peer: peer() })).status).toBe(200);
        for (let i = 0; i < SIGN_IN_ACCOUNT_FAILURE_LIMIT.max - 1; i += 1) {
          expect((await signIn(email, `${PASSWORD} wrong`, { peer: peer() })).status).toBe(401);
        }
        for (let i = 0; i < 3; i += 1) expect((await signIn(email, PASSWORD, { peer: peer(), backend: i % 2 })).status).toBe(200);
        expect((await signIn(email, `${PASSWORD} wrong`, { peer: peer() })).status).toBe(401);
        await expectUniform429(await signIn(email, PASSWORD, { peer: peer() }));
      },
      TEST_TIMEOUT,
    );

    it(
      "sign-up per IP: 10 per hour",
      async () => {
        const via = { peer: peer() };
        for (let i = 0; i < SIGN_UP_IP_LIMIT.max; i += 1) {
          expect((await signUp(uniqueEmail(), { ...via, backend: i % 2 })).status).toBe(200);
        }
        await expectUniform429(await signUp(uniqueEmail(), via));
      },
      TEST_TIMEOUT,
    );

    it(
      "two-factor verify per IP: 10 per minute over both verify paths",
      async () => {
        const via = { peer: peer() };
        for (let i = 0; i < TWO_FACTOR_VERIFY_IP_LIMIT.max; i += 1) {
          const path = i % 2 === 0 ? "/two-factor/verify-totp" : "/two-factor/verify-backup-code";
          expect((await api(path, { ...via, backend: i % 2 }, { code: "000000" })).status).toBe(401);
        }
        await expectUniform429(await api("/two-factor/verify-totp", via, { code: "000000" }));
      },
      TEST_TIMEOUT,
    );

    it(
      "password check per IP: 10 per 15 minutes over the paths that take a password",
      async () => {
        const via = { peer: peer() };
        const paths = ["/change-password", "/two-factor/enable", "/two-factor/disable", "/two-factor/generate-backup-codes"];
        for (let i = 0; i < PASSWORD_CHECK_IP_LIMIT.max; i += 1) {
          const body = { password: PASSWORD, currentPassword: PASSWORD, newPassword: `${PASSWORD} new`, revokeOtherSessions: true };
          expect((await api(paths[i % paths.length] ?? "", { ...via, backend: i % 2 }, body)).status).toBe(401);
        }
        await expectUniform429(await api("/change-password", via, { currentPassword: PASSWORD, newPassword: `${PASSWORD} new` }));
      },
      TEST_TIMEOUT,
    );
  });

  it(
    "AUTH-06: a counter is shared by the two processes and survives restarting one of them",
    async () => {
      const via = { peer: peer() };
      for (let i = 0; i < SIGN_IN_IP_LIMIT.max; i += 1) {
        expect((await signIn(uniqueEmail(), `${PASSWORD} wrong`, { ...via, backend: i < 6 ? 0 : 1 })).status).toBe(401);
      }
      await expectUniform429(await signIn(uniqueEmail(), PASSWORD, { ...via, backend: 0 }));
      await edge.backends[1]?.stop();
      edge.backends[1] = await startNext(env);
      await expectUniform429(await signIn(uniqueEmail(), PASSWORD, { ...via, backend: 1 }));
      expect(await count(`ba:sign-in:${via.peer}`)).toBe(SIGN_IN_IP_LIMIT.max);
    },
    TEST_TIMEOUT,
  );

  it(
    "client-IP parity: the route and the sign-in form from one edge IP reach the limit together, not at twice it",
    async () => {
      const via = { peer: peer() };
      for (let i = 0; i < SIGN_IN_IP_LIMIT.max; i += 1) {
        if (i % 2 === 0) expect((await signIn(uniqueEmail(), `${PASSWORD} wrong`, via)).status).toBe(401);
        else expect(await formSignIn(uniqueEmail(), `${PASSWORD} wrong`, { ...via, backend: 1 })).toBe("failed");
      }
      expect(await formSignIn(uniqueEmail(), PASSWORD, via)).toBe("limited");
      await expectUniform429(await signIn(uniqueEmail(), PASSWORD, { ...via, backend: 1 }));
    },
    TEST_TIMEOUT,
  );

  it(
    "forged headers, rotated on every request, to the route and through the form: keyed by the edge IP",
    async () => {
      const via = { peer: peer() };
      const forgedHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = {
          "x-forwarded-for": `${forged()}, ${forged()}`,
          forwarded: `for=${forged()}`,
          "x-real-ip": forged(),
          "cf-connecting-ip": forged(),
          "x-crm-client-ip": forged(),
        };
        // The edge overwrites its own header; every other one reaches the app as the caller sent it.
        return headers;
      };
      for (let i = 0; i < SIGN_IN_IP_LIMIT.max; i += 1) {
        const forgedVia = { ...via, headers: forgedHeaders(), backend: i % 2 };
        if (i % 2 === 0) expect((await signIn(uniqueEmail(), `${PASSWORD} wrong`, forgedVia)).status).toBe(401);
        else expect(await formSignIn(uniqueEmail(), `${PASSWORD} wrong`, forgedVia)).toBe("failed");
      }
      expect(await formSignIn(uniqueEmail(), PASSWORD, { ...via, headers: forgedHeaders() })).toBe("limited");
      await expectUniform429(await signIn(uniqueEmail(), PASSWORD, { ...via, headers: forgedHeaders() }));
      const keys = (await admin<{ key: string }[]>`select key from rate_limit where key like 'ba:sign-in:%'`).map((row) => row.key);
      expect(keys).toEqual([`ba:sign-in:${via.peer}`]);
    },
    TEST_TIMEOUT,
  );

  it(
    "fallback: with the header malformed (or, under cf-connecting-ip, missing), every request shares the placeholder key",
    async () => {
      // Under x-forwarded-for, Next 16.4.x (checked on 16.4.6) fills a missing header with the socket peer (next/dist/server/base-server.js:604),
      // which is the edge itself: the next test.
      const modes: EdgeMode[] = trustedHeader === "x-forwarded-for" ? ["malformed"] : ["omit", "malformed"];
      for (let i = 0; i < SIGN_IN_IP_LIMIT.max; i += 1) {
        const via: Via = { peer: peer(), mode: modes[i % modes.length], backend: i % 2 };
        if (i % 3 === 0) expect(await formSignIn(uniqueEmail(), `${PASSWORD} wrong`, via)).toBe("failed");
        else expect((await signIn(uniqueEmail(), `${PASSWORD} wrong`, via)).status).toBe(401);
      }
      await expectUniform429(await signIn(uniqueEmail(), PASSWORD, { peer: peer(), mode: modes[0] }));
      expect(await count(`ba:sign-in:${PLACEHOLDER_CLIENT_IP}`)).toBe(SIGN_IN_IP_LIMIT.max);
      for (const server of edge.backends) expect(server.output()).toContain('"msg":"client ip fallback"');
    },
    TEST_TIMEOUT,
  );

  it.runIf(trustedHeader === "x-forwarded-for")(
    "x-forwarded-for with the edge not setting it: Next keys every request by the edge's own address, still limited",
    async () => {
      for (let i = 0; i < SIGN_IN_IP_LIMIT.max; i += 1) {
        const via: Via = { peer: peer(), mode: "omit", backend: i % 2 };
        if (i % 3 === 0) expect(await formSignIn(uniqueEmail(), `${PASSWORD} wrong`, via)).toBe("failed");
        else expect((await signIn(uniqueEmail(), `${PASSWORD} wrong`, via)).status).toBe(401);
      }
      await expectUniform429(await signIn(uniqueEmail(), PASSWORD, { peer: peer(), mode: "omit" }));
      expect(await count("ba:sign-in:127.0.0.1")).toBe(SIGN_IN_IP_LIMIT.max);
    },
    TEST_TIMEOUT,
  );

  it(
    "Better Auth concurrency: at 9 of 10, 30 concurrent sign-ins across both processes let exactly one more through",
    async () => {
      const via = { peer: peer() };
      for (let i = 0; i < SIGN_IN_IP_LIMIT.max - 1; i += 1) {
        expect((await signIn(uniqueEmail(), `${PASSWORD} wrong`, via)).status).toBe(401);
      }
      const replies = await Promise.all(
        Array.from({ length: 30 }, (_, i) => signIn(uniqueEmail(), `${PASSWORD} wrong`, { ...via, backend: i % 2 })),
      );
      const statuses = replies.map((reply) => reply.status);
      expect(statuses.filter((status) => status !== 429)).toEqual([401]);
      expect(await count(`ba:sign-in:${via.peer}`)).toBe(SIGN_IN_IP_LIMIT.max);
    },
    TEST_TIMEOUT,
  );
});
