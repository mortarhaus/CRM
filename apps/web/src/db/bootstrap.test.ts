import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { roleMemberships, roleAttributes } from "../test/catalog";
import { roleUrl, startPostgres, TEST_ROLE_PASSWORDS } from "../test/postgres";
import { bootstrapRoles, scramVerifier } from "./bootstrap";

const TSX = fileURLToPath(new URL("../../node_modules/.bin/tsx", import.meta.url));
const BOOTSTRAP_CLI = fileURLToPath(new URL("../../scripts/bootstrap-roles.ts", import.meta.url));

const LOGIN_ROLES = ["crm_migrator", "crm_app", "crm_worker", "crm_purge"] as const;

let container: StartedPostgreSqlContainer;
let admin: postgres.Sql;

beforeAll(async () => {
  container = await startPostgres();
  admin = postgres(container.getConnectionUri(), { max: 1, onnotice: () => {} });
  await bootstrapRoles(admin, TEST_ROLE_PASSWORDS);
  await bootstrapRoles(admin, TEST_ROLE_PASSWORDS);
});

afterAll(async () => {
  await admin?.end();
  await container?.stop();
});

async function connectAs(role: string, password: string): Promise<string> {
  const sql = postgres(roleUrl(container.getConnectionUri(), role, password), { max: 1 });
  try {
    const [row] = await sql<{ user: string }[]>`select current_user as user`;
    return row?.user ?? "";
  } finally {
    await sql.end();
  }
}

describe("bootstrapRoles", () => {
  it("creates the five roles with no superuser, BYPASSRLS, CREATEROLE, CREATEDB or REPLICATION", async () => {
    expect(await roleAttributes(admin)).toEqual([
      { name: "crm_app", login: true, inherit: true, connectionLimit: -1, elevated: false },
      { name: "crm_link_resolver", login: false, inherit: false, connectionLimit: -1, elevated: false },
      { name: "crm_migrator", login: true, inherit: true, connectionLimit: -1, elevated: false },
      { name: "crm_purge", login: true, inherit: false, connectionLimit: 2, elevated: false },
      { name: "crm_worker", login: true, inherit: true, connectionLimit: -1, elevated: false },
    ]);
  });

  it("makes crm_migrator the database owner", async () => {
    const [row] = await admin<{ owner: string }[]>`
      select pg_get_userbyid(datdba) as owner from pg_database where datname = current_database()`;
    expect(row?.owner).toBe("crm_migrator");
  });

  it("makes crm_migrator a member of crm_link_resolver only to SET it, and no role a member of any other", async () => {
    expect(await roleMemberships(admin)).toEqual([
      { role: "crm_link_resolver", member: "crm_migrator", admin: false, inherit: false, set: true },
    ]);
  });

  it.each(LOGIN_ROLES)("lets %s sign in with its password", async (role) => {
    const key = role.replace("crm_", "") as keyof typeof TEST_ROLE_PASSWORDS;
    expect(await connectAs(role, TEST_ROLE_PASSWORDS[key])).toBe(role);
  });

  it("sets crm_purge's password only when one is given", async () => {
    const { migrator, app, worker } = TEST_ROLE_PASSWORDS;
    await bootstrapRoles(admin, { migrator, app, worker });
    const [row] = await admin<{ hasPassword: boolean }[]>`
      select rolpassword is not null as "hasPassword" from pg_authid where rolname = 'crm_purge'`;
    expect(row?.hasPassword).toBe(false);
    await expect(connectAs("crm_purge", TEST_ROLE_PASSWORDS.purge)).rejects.toMatchObject({ code: "28P01" });

    await bootstrapRoles(admin, TEST_ROLE_PASSWORDS);
    expect(await connectAs("crm_purge", TEST_ROLE_PASSWORDS.purge)).toBe("crm_purge");
  });

  it("changes a password on a rerun and refuses the old one", async () => {
    const rotated = "crm-app-rotated-test-only";
    await bootstrapRoles(admin, { ...TEST_ROLE_PASSWORDS, app: rotated });
    try {
      expect(await connectAs("crm_app", rotated)).toBe("crm_app");
      await expect(connectAs("crm_app", TEST_ROLE_PASSWORDS.app)).rejects.toMatchObject({ code: "28P01" });
    } finally {
      await bootstrapRoles(admin, TEST_ROLE_PASSWORDS);
    }
  });

  it("repairs a drifted role attribute on a rerun", async () => {
    await admin.unsafe("ALTER ROLE crm_app BYPASSRLS CREATEDB");
    await bootstrapRoles(admin, TEST_ROLE_PASSWORDS);
    const app = (await roleAttributes(admin)).find((role) => role.name === "crm_app");
    expect(app?.elevated).toBe(false);
  });
});

// Distinct marker passwords, so a leak of any of them is found by a plain substring search.
function markerPasswords() {
  const tag = randomUUID();
  return {
    migrator: `leak-check-migrator-${tag}`,
    app: `leak-check-app-${tag}`,
    worker: `leak-check-worker-${tag}`,
    purge: `leak-check-purge-${tag}`,
  };
}

// Reverses the one allowed membership, so the bootstrap's GRANT fails after every password statement.
async function breakMembership(): Promise<void> {
  await admin.unsafe("REVOKE crm_link_resolver FROM crm_migrator");
  await admin.unsafe("GRANT crm_migrator TO crm_link_resolver");
}

async function repairMembership(): Promise<void> {
  await admin.unsafe("REVOKE crm_migrator FROM crm_link_resolver");
  await bootstrapRoles(admin, TEST_ROLE_PASSWORDS);
}

function leaks(text: string, passwords: Record<string, string>): string[] {
  return Object.entries(passwords)
    .filter(([, password]) => text.includes(password))
    .map(([role]) => role);
}

describe("bootstrapRoles password handling (UNI-09)", () => {
  it("stores the same SCRAM-SHA-256 verifier Postgres computes for that password and salt", async () => {
    const password = "scram-check-test-only";
    await admin.unsafe("CREATE ROLE crm_scram_check NOLOGIN");
    try {
      await admin.unsafe(`ALTER ROLE crm_scram_check PASSWORD '${password}'`);
      const [row] = await admin<{ stored: string }[]>`
        select rolpassword as stored from pg_authid where rolname = 'crm_scram_check'`;
      const salt = /^SCRAM-SHA-256\$4096:([^$]+)\$/.exec(row?.stored ?? "")?.[1];
      expect(salt).toBeDefined();
      expect(scramVerifier(password, Buffer.from(salt ?? "", "base64"))).toBe(row?.stored);
    } finally {
      await admin.unsafe("DROP ROLE crm_scram_check");
    }
  });

  it("gives every login role a SCRAM-SHA-256 verifier with its own salt", async () => {
    const rows = await admin<{ stored: string }[]>`
      select rolpassword as stored from pg_authid where rolname = any(${[...LOGIN_ROLES]})`;
    expect(rows).toHaveLength(LOGIN_ROLES.length);
    for (const row of rows) expect(row.stored).toMatch(/^SCRAM-SHA-256\$4096:/);
    expect(new Set(rows.map((row) => row.stored.split("$")[2])).size).toBe(LOGIN_ROLES.length);
  });

  it("keeps the passwords and their verifiers out of the Postgres log, even with log_statement = all", async () => {
    const passwords = markerPasswords();
    const logs = await container.logs();
    let captured = "";
    logs.on("data", (chunk: Buffer) => (captured += chunk.toString()));
    await admin.unsafe("ALTER SYSTEM SET log_statement = 'all'");
    await admin.unsafe("ALTER SYSTEM SET log_min_error_statement = 'error'");
    await admin`select pg_reload_conf()`;
    try {
      await bootstrapRoles(admin, passwords);
      await breakMembership();
      await expect(bootstrapRoles(admin, passwords)).rejects.toThrow();
      // The sentinel proves statements are logged: once it is in, every earlier line is too.
      const sentinel = `log-sentinel-${randomUUID()}`;
      await admin.unsafe(`select '${sentinel}'`);
      await vi.waitFor(() => expect(captured).toContain(sentinel), { timeout: 10_000, interval: 100 });
    } finally {
      logs.destroy();
      await admin.unsafe("ALTER SYSTEM RESET log_statement");
      await admin.unsafe("ALTER SYSTEM RESET log_min_error_statement");
      await admin`select pg_reload_conf()`;
      await repairMembership();
    }
    expect(captured).toContain("GRANT crm_migrator TO crm_link_resolver");
    expect(leaks(captured, passwords)).toEqual([]);
    expect(captured).not.toContain("SCRAM-SHA-256$");
    expect(captured).not.toContain("ALTER ROLE crm_app PASSWORD");
  });

  it("keeps the passwords out of the error a failed bootstrap throws", async () => {
    const passwords = markerPasswords();
    await breakMembership();
    let error: unknown;
    try {
      await bootstrapRoles(admin, passwords);
    } catch (caught) {
      error = caught;
    } finally {
      await repairMembership();
    }
    expect(error).toBeInstanceOf(Error);
    const { message, stack, query, parameters } = error as Error & { query?: string; parameters?: unknown };
    const text = [message, stack, query, JSON.stringify(parameters), JSON.stringify(error)].join("\n");
    expect(leaks(text, passwords)).toEqual([]);
  });

  it("keeps the passwords out of the CLI's output when the bootstrap fails", async () => {
    const passwords = markerPasswords();
    await breakMembership();
    // Cast: Next's types declare NODE_ENV as always present on ProcessEnv; this child env has only these.
    const env: Record<string, string | undefined> = {
      PATH: process.env.PATH,
      DATABASE_ADMIN_URL: container.getConnectionUri(),
      CRM_MIGRATOR_PASSWORD: passwords.migrator,
      CRM_APP_PASSWORD: passwords.app,
      CRM_WORKER_PASSWORD: passwords.worker,
      CRM_PURGE_PASSWORD: passwords.purge,
    };
    let output: string | undefined;
    try {
      await promisify(execFile)(TSX, [BOOTSTRAP_CLI], { env: env as NodeJS.ProcessEnv });
      throw new Error("expected the bootstrap CLI to fail");
    } catch (error) {
      const failed = error as { code?: number; stdout?: string; stderr?: string };
      expect(failed.code).toBe(1);
      output = `${failed.stdout ?? ""}${failed.stderr ?? ""}`;
    } finally {
      await repairMembership();
    }
    expect(output).toMatch(/crm_link_resolver|crm_migrator/);
    expect(leaks(output ?? "", passwords)).toEqual([]);
  });
});
