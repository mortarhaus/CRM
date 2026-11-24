import { PeriodBehindError, RESET_RULES, type ResetRule } from "@crm/core/numbering";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client";
import { runInWorkspace } from "../workspace";
import { allocateNumber, previewNumber } from "./allocate";
import { startNumberingDb, type NumberingTestDb } from "../../test/numbering-db";
import { updateSequence } from "./sequence";

// Phase 2 done-when "Pattern preview matches issued numbers" (spec line 1138), through a test harness because no
// document is issued before Phase 4: for random patterns, reset rules, time zones and instants, the preview taken
// just before an issue equals the number the issue gets. A seeded generator, so a failure can be replayed. Time only
// moves forward in each workspace (sorted instants), as the database clock does; every 7th round also tries a
// backdated instant, where the preview and the allocator must agree too (the same number, or both PeriodBehindError).
const ROUNDS = 300;
const TIME_ZONES = ["Asia/Kuala_Lumpur", "Asia/Singapore", "UTC", "America/New_York", "Pacific/Auckland", "Asia/Kolkata"];

function generator(seed: number) {
  let state = seed;
  const next = () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 31;
  };
  return { int: (n: number) => Math.floor(next() * n), pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T };
}

// A random pattern that fits the rule: free text and tokens in random order, one {SEQ:n}, and the period tokens the
// rule needs.
function randomPattern(random: ReturnType<typeof generator>, rule: ResetRule): string {
  const parts = [`{SEQ:${1 + random.int(6)}}`];
  if (rule !== "never") parts.push(random.pick(["{YYYY}", "{YY}"]));
  if (rule === "monthly") parts.push("{MM}");
  for (let extra = random.int(4); extra > 0; extra -= 1) parts.push(random.pick(["{CODE}", "{YYYY}", "{YY}", "{MM}", "INV", "-", "/", "#", "Q"]));
  for (let i = parts.length - 1; i > 0; i -= 1) {
    const j = random.int(i + 1);
    [parts[i], parts[j]] = [parts[j] as string, parts[i] as string];
  }
  return parts.join(random.pick(["", "-"]));
}

let db: NumberingTestDb;
let handle: DbHandle;
let actor: string;

beforeAll(async () => {
  db = await startNumberingDb();
  handle = createDb(db.database.appUrl, { max: 2 });
  const [user] = await db.admin<{ id: string }[]>`insert into "user" (name, email) values ('Admin', 'numbering-admin@example.test') returning id`;
  if (!user) throw new Error("user not created");
  actor = user.id;
});

afterAll(async () => {
  await handle?.sql.end();
  await db?.stop();
});

it(`previewNumber then allocateNumber give the same number (${ROUNDS} random rounds)`, async () => {
  const random = generator(20_261_123);
  const workspaces = new Map<string, string>();
  for (const timeZone of TIME_ZONES) workspaces.set(timeZone, await db.newWorkspace({ timeZone, shortCode: "AB12" }));
  // Instants from 2025 to 2028, in random order, with many on period boundaries (±1 s of a month start in UTC±14 h).
  const start = Date.UTC(2025, 0, 1);
  const randomInstant = () => {
    if (random.int(2) === 0) return new Date(start + random.int(4 * 365 * 24 * 3600) * 1000);
    const boundary = Date.UTC(2025 + random.int(4), random.int(12), 1) + (random.int(29) - 14) * 3600 * 1000;
    return new Date(boundary + (random.int(3) - 1) * 1000);
  };

  // The same number, or the same refusal, from the preview and the allocator at `at`.
  const outcome = (promise: Promise<string>) =>
    promise.then(
      (number) => number,
      (error: unknown) => {
        if (error instanceof PeriodBehindError) return "PeriodBehindError";
        throw error;
      },
    );
  const previewThenAllocate = (workspace: string, at: Date) =>
    runInWorkspace(handle.db, workspace, async (tx) => [
      await outcome(previewNumber(tx, "invoice", at)),
      await outcome(allocateNumber(tx, "invoice", { clock: async () => at }).then((taken) => taken.number)),
    ]);

  const instants = Array.from({ length: ROUNDS }, randomInstant).sort((x, y) => x.getTime() - y.getTime());
  let issued = 0;
  let backdatedRefused = 0;
  for (let round = 0; round < ROUNDS; round += 1) {
    const timeZone = random.pick(TIME_ZONES);
    const workspace = workspaces.get(timeZone) as string;
    const at = instants[round] as Date;
    if (round % 10 === 0) {
      const resetRule = random.pick(RESET_RULES);
      const pattern = randomPattern(random, resetRule);
      await runInWorkspace(handle.db, workspace, async (tx) => {
        const [row] = await db.admin<{ version: number }[]>`select version from doc_sequence where workspace_id = ${workspace}`;
        await updateSequence(tx, "invoice", { pattern, resetRule }, row?.version ?? 0, actor, timeZone, { clock: async () => at });
      });
    }
    const [previewed, allocated] = await previewThenAllocate(workspace, at);
    expect(allocated, `round ${round}, ${timeZone}, ${at.toISOString()}`).toBe(previewed);
    expect(allocated).not.toBe("PeriodBehindError");
    issued += 1;
    if (round % 7 === 3) {
      const backdated = new Date(at.getTime() - (1 + random.int(60)) * 24 * 3600 * 1000);
      const [previewedBack, allocatedBack] = await previewThenAllocate(workspace, backdated);
      expect(allocatedBack, `backdated round ${round}, ${timeZone}, ${backdated.toISOString()}`).toBe(previewedBack);
      if (allocatedBack === "PeriodBehindError") backdatedRefused += 1;
    }
  }
  expect(issued).toBe(ROUNDS);
  // The backdated tries cross a period boundary often enough to exercise the refusal.
  expect(backdatedRefused).toBeGreaterThan(0);
});
