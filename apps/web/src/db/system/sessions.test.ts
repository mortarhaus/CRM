import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { createDb, type DbHandle } from "../client";
import { revokeOwnSession } from "./sessions";

// PR #44 Round 1 P2-3 (plan Task 24 note): /list-sessions returns no token, so /revoke-session cannot end one chosen
// session. revokeOwnSession ends the caller's own session by id and never another user's.

let database: TestDatabase;
let admin: postgres.Sql;
let app: DbHandle;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  app = createDb(database.appUrl);
});

afterAll(async () => {
  await app?.sql.end();
  await admin?.end();
  await database?.stop();
});

async function user(): Promise<string> {
  const id = randomUUID();
  await admin`insert into "user" (id, name, email, email_verified, created_at, updated_at)
    values (${id}, 'Session Person', ${`${id}@example.test`}, false, now(), now())`;
  return id;
}

async function session(userId: string): Promise<string> {
  const id = randomUUID();
  await admin`insert into session (id, user_id, token, expires_at, created_at, updated_at, issue_reason)
    values (${id}, ${userId}, ${randomUUID()}, now() + interval '1 day', now(), now(), 'password')`;
  return id;
}

async function sessionIds(userId: string): Promise<string[]> {
  return (await admin<{ id: string }[]>`select id from session where user_id = ${userId} order by id`).map((row) => row.id);
}

describe("revokeOwnSession", () => {
  it("ends the caller's own session with that id, and only that one", async () => {
    const u1 = await user();
    const [a, b] = [await session(u1), await session(u1)];
    expect(await revokeOwnSession(u1, a, app.db)).toBe(true);
    expect(await sessionIds(u1)).toEqual([b]);
  });

  it("refuses another user's session id: nothing is deleted", async () => {
    const [u1, u2] = [await user(), await user()];
    await session(u1);
    const theirs = await session(u2);
    expect(await revokeOwnSession(u1, theirs, app.db)).toBe(false);
    expect(await sessionIds(u2)).toEqual([theirs]);
  });

  it("answers false for an unknown or malformed id", async () => {
    const u1 = await user();
    expect(await revokeOwnSession(u1, randomUUID(), app.db)).toBe(false);
    expect(await revokeOwnSession(u1, "not-a-uuid", app.db)).toBe(false);
  });
});
