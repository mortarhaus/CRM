import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import type postgres from "postgres";

export interface RolePasswords {
  migrator: string;
  app: string;
  worker: string;
  purge?: string;
}

const NOT_ELEVATED = "NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION";

// The full attribute list is applied on every run, so a rerun also repairs drift.
const ROLE_ATTRIBUTES = {
  crm_migrator: `LOGIN ${NOT_ELEVATED} INHERIT`,
  crm_app: `LOGIN ${NOT_ELEVATED} INHERIT`,
  crm_worker: `LOGIN ${NOT_ELEVATED} INHERIT`,
  crm_purge: `LOGIN ${NOT_ELEVATED} NOINHERIT CONNECTION LIMIT 2`,
  crm_link_resolver: `NOLOGIN ${NOT_ELEVATED} NOINHERIT`,
} as const;

const SCRAM_ITERATIONS = 4096;

// A SCRAM-SHA-256 verifier in the form Postgres stores in pg_authid (RFC 5802, RFC 7677). Postgres
// stores a value in this form as it is, so the plain-text password never reaches the server.
// Passwords are printable ASCII (parseBootstrapEnv), where SASLprep changes nothing.
export function scramVerifier(password: string, salt: Buffer = randomBytes(16)): string {
  const salted = pbkdf2Sync(password, salt, SCRAM_ITERATIONS, 32, "sha256");
  const storedKey = createHash("sha256").update(createHmac("sha256", salted).update("Client Key").digest()).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${SCRAM_ITERATIONS}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

// Utility statements take no bind parameters, so format() quotes the bound values on the server.
async function setPassword(tx: postgres.TransactionSql, role: string, password: string): Promise<void> {
  const [row] = await tx<{ stmt: string }[]>`select format('ALTER ROLE %I PASSWORD %L', ${role}::text, ${scramVerifier(password)}::text) as stmt`;
  if (!row) throw new Error("format() returned no statement");
  await tx.unsafe(row.stmt);
}

// Roles are cluster objects, so this runs once per cluster with an admin connection, before migrations.
export async function bootstrapRoles(adminSql: postgres.Sql, passwords: RolePasswords): Promise<void> {
  await adminSql.begin(async (tx) => {
    // Defence in depth (UNI-09): even the verifier stays out of the server log, whatever the server's
    // log settings, and a failing statement is not logged with its text. Needs a superuser admin.
    await tx.unsafe("SET LOCAL log_statement = 'none'");
    await tx.unsafe("SET LOCAL log_min_error_statement = 'panic'");
    await tx.unsafe("SET LOCAL log_min_duration_statement = -1");
    await tx.unsafe("SET LOCAL log_min_duration_sample = -1");
    await tx.unsafe("SET LOCAL log_transaction_sample_rate = 0");
    for (const [role, attributes] of Object.entries(ROLE_ATTRIBUTES)) {
      await tx.unsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role}; END IF; END $$`,
      );
      await tx.unsafe(`ALTER ROLE ${role} ${attributes}`);
    }

    await setPassword(tx, "crm_migrator", passwords.migrator);
    await setPassword(tx, "crm_app", passwords.app);
    await setPassword(tx, "crm_worker", passwords.worker);
    // Without a password crm_purge cannot pass scram-sha-256 (Settled item 1: no purge login until Phase 9).
    if (passwords.purge === undefined) await tx.unsafe("ALTER ROLE crm_purge PASSWORD NULL");
    else await setPassword(tx, "crm_purge", passwords.purge);

    // Spec: crm_migrator is a member of crm_link_resolver only so migrations can set ownership.
    await tx.unsafe("GRANT crm_link_resolver TO crm_migrator WITH INHERIT FALSE, SET TRUE");
    await tx.unsafe(
      "DO $$ BEGIN EXECUTE format('ALTER DATABASE %I OWNER TO crm_migrator', current_database()); END $$",
    );
  });
}
