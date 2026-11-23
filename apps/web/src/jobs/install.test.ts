import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PgBoss } from "pg-boss";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, permissionErrors, serverLog, sqlState, startDatabase, type TestDatabase } from "../test/postgres";
import { pgbossInstallSql } from "./install-sql";

// pg-boss's own record of the schema it builds, so an upgrade of the package fails these tests until the install
// migration is regenerated for it.
const manifest = createRequire(import.meta.url)("pg-boss/dist/schema.json") as {
  version: number;
  partitioned: { tables: string[] };
};

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";

let db: TestDatabase;
let admin: postgres.Sql;
let app: postgres.Sql;

beforeAll(async () => {
  db = await startDatabase({ serverLog: true });
  admin = postgres(db.adminUrl, { max: 1, onnotice: () => {} });
  app = postgres(db.appUrl, { max: 1, prepare: false });
});

afterAll(async () => {
  await app?.end();
  await admin?.end();
  await db?.stop();
});

// The web send-only instance (spec "Domain events and jobs"): crm_app, every switch that writes off.
function sendOnlyBoss(): { boss: PgBoss; errors: unknown[] } {
  const boss = new PgBoss({
    connectionString: db.appUrl,
    migrate: false,
    createSchema: false,
    supervise: false,
    schedule: false,
    max: 2,
    // The shortest the package allows, so the queue cache refresh runs inside the test.
    queueCacheIntervalSeconds: 1,
  });
  const errors: unknown[] = [];
  boss.on("error", (error) => errors.push(error));
  return { boss, errors };
}

describe("pg-boss install migration", () => {
  it("is the package's construction plan for its version, without the transaction wrapper", async () => {
    const committed = await readFile(join(MIGRATIONS_DIR, "0015_pgboss_install.sql"), "utf8");
    expect(committed).toBe(pgbossInstallSql());
  });

  it("installs the schema version of the installed package", async () => {
    expect(await admin`select version from pgboss.version`).toEqual([{ version: manifest.version }]);
  });

  it("creates exactly the package's tables (plus queue_stats day partitions), owned by crm_migrator", async () => {
    const rows = await admin<{ name: string; parent: string | null; owner: string }[]>`
      select c.relname as name, p.relname as parent, pg_get_userbyid(c.relowner) as owner
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_inherits i on i.inhrelid = c.oid
      left join pg_class p on p.oid = i.inhparent
      where n.nspname = 'pgboss' and c.relkind in ('r', 'p')
      order by 1`;
    const partitions = rows.filter((row) => row.parent === "queue_stats");
    expect(partitions.length).toBeGreaterThan(0);
    for (const partition of partitions) expect(partition.name).toMatch(/^queue_stats_\d{8}$/);
    // job_common is job's DEFAULT partition and is one of the package's tables.
    expect(rows.filter((row) => row.parent !== "queue_stats").map((row) => row.name)).toEqual(
      [...manifest.partitioned.tables].sort(),
    );
    expect(rows.filter((row) => row.owner !== "crm_migrator")).toEqual([]);
  });
});

describe("queues (migration, spec: queue options change only in migrations)", () => {
  // Six application queues (migration 0016), the owner email queues (0032) and pg-boss's internal cron queue
  // __pgboss__send-it (migration 0017, created by crm_migrator so the patched worker start() never creates it).
  it("are the eight application queues and the internal cron queue, with notify off", async () => {
    const rows = await admin`
      select name, policy, retry_limit, retry_delay, retry_backoff, dead_letter, notify, partition
      from pgboss.queue order by name collate "C"`;
    const retried = { policy: "standard", retry_limit: 5, retry_delay: 30, retry_backoff: true, notify: false, partition: false };
    const plain = { retry_limit: 2, retry_delay: 0, retry_backoff: false, dead_letter: null, notify: false, partition: false };
    expect(rows).toEqual([
      { name: "__pgboss__send-it", policy: "standard", ...plain },
      { name: "domain_event", ...retried, dead_letter: "domain_event.dead" },
      { name: "domain_event.dead", policy: "standard", ...plain },
      { name: "email.bank_details_changed", ...retried, dead_letter: "email.bank_details_changed.dead" },
      { name: "email.bank_details_changed.dead", policy: "standard", ...plain },
      { name: "email.send", ...retried, dead_letter: "email.send.dead" },
      { name: "email.send.dead", policy: "standard", ...plain },
      { name: "idempotency.cleanup", policy: "singleton", ...plain },
      { name: "rate_limit.cleanup", policy: "singleton", ...plain },
    ]);
  });

  // Unpatched, start() calls createQueue(QUEUES.SEND_IT) with no options, which runs
  // create_queue('__pgboss__send-it', '{"policy":"standard"}'). The row 0017 made must equal the one that call makes.
  it("the cron queue row of 0017 is the row unpatched pg-boss start() would create", async () => {
    const columns = async (sql: postgres.TransactionSql, name: string) => {
      const [row] = await sql<Record<string, unknown>[]>`select * from pgboss.queue where name = ${name}`;
      if (!row) throw new Error(`no queue ${name}`);
      return Object.fromEntries(Object.entries(row).filter(([key]) => !["name", "created_on", "updated_on"].includes(key)));
    };
    const rollback = new Error("rollback");
    const compared = await admin
      .begin(async (sql) => {
        await sql`select pgboss.create_queue('crm_probe', '{"policy":"standard"}'::jsonb)`;
        const probe = await columns(sql, "crm_probe");
        const sendIt = await columns(sql, "__pgboss__send-it");
        expect(Object.keys(sendIt).length).toBeGreaterThan(10);
        expect(sendIt).toEqual(probe);
        throw rollback;
      })
      .catch((error: unknown) => error);
    expect(compared).toBe(rollback);
    expect(await admin`select name from pgboss.queue where name = 'crm_probe'`).toEqual([]);
  });
});

describe("crm_app: the web send-only instance (enqueue only)", () => {
  it("starts, sends, refreshes its queue cache and stops with no error and no permission error", async () => {
    const { boss, errors } = sendOnlyBoss();
    await boss.start();
    const id = await boss.send("email.send", { workspaceId: WORKSPACE_ID, userId: USER_ID });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // Two queue cache refreshes at the 1 s interval.
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await boss.stop({ graceful: true });
    expect(errors).toEqual([]);
    const [job] = await admin`select name, state, data from pgboss.job_common where id = ${id ?? ""}`;
    expect(job).toEqual({ name: "email.send", state: "created", data: { workspaceId: WORKSPACE_ID, userId: USER_ID } });
    expect(permissionErrors(await serverLog(db.container), "crm_app")).toEqual([]);
  });

  it("cannot read job payloads (spec Phase 1 done-when: crm_app cannot read job payloads)", async () => {
    expect(await sqlState(app`select data from pgboss.job_common`)).toBe("42501");
    expect(await sqlState(app`select output from pgboss.job_common`)).toBe("42501");
    expect(await sqlState(app`select * from pgboss.job_common`)).toBe("42501");
    expect(await sqlState(app`select * from pgboss.job`)).toBe("42501");
    // The log check of the lifetime test above sees these denials, so its empty result means something.
    const denied = permissionErrors(await serverLog(db.container), "crm_app");
    expect(denied.some((line) => line.includes("select data from pgboss.job_common"))).toBe(true);
  });

  it("reads only the job id and start_after", async () => {
    expect(await sqlState(app`select id, start_after from pgboss.job_common`)).toBeUndefined();
  });

  it("cannot change, fetch or create work", async () => {
    expect(await sqlState(app`update pgboss.job_common set state = 'cancelled'`)).toBe("42501");
    expect(await sqlState(app`delete from pgboss.job_common`)).toBe("42501");
    expect(await sqlState(app`select pgboss.create_queue('probe', '{}'::jsonb)`)).toBe("42501");
    expect(await sqlState(app`select * from pgboss.schedule`)).toBe("42501");
  });
});

// Ablation (Settled item 2): each crm_app grant is needed by the send-only instance; without it, start or send
// fails with 42501. Revoked through the admin connection and restored after each case.
describe.each([
  ["USAGE on schema pgboss", "USAGE ON SCHEMA pgboss"],
  ["SELECT on pgboss.version", "SELECT ON pgboss.version"],
  ["SELECT on pgboss.queue", "SELECT ON pgboss.queue"],
  ["INSERT on pgboss.job_common", "INSERT ON pgboss.job_common"],
  ["SELECT (id) on pgboss.job_common", "SELECT (id) ON pgboss.job_common"],
  ["EXECUTE on pgboss.job_now()", "EXECUTE ON FUNCTION pgboss.job_now()"],
])("crm_app ablation: without %s", (_label, grant) => {
  it("start or send fails with 42501", async () => {
    await admin.unsafe(`REVOKE ${grant} FROM crm_app`);
    try {
      const { boss } = sendOnlyBoss();
      boss.on("error", () => {});
      const state = await sqlState(
        (async () => {
          await boss.start();
          try {
            await boss.send("email.send", { workspaceId: WORKSPACE_ID, userId: USER_ID });
          } finally {
            await boss.stop({ graceful: false });
          }
        })(),
      );
      expect(state).toBe("42501");
    } finally {
      await admin.unsafe(`GRANT ${grant} TO crm_app`);
    }
  });
});
