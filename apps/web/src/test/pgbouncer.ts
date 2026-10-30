import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { roleUrl, TEST_ROLE_PASSWORDS, type TestDatabase } from "./postgres";

// PgBouncer 1.25.2, the version Spike 1 proved (CRM-spikes/RESULTS.md), pinned by tag and index digest
// (docs/DECISIONS.md 2026-10-30). Tests only.
export const PGBOUNCER_IMAGE =
  "edoburu/pgbouncer:v1.25.2-p0@sha256:7d7a27d9e90985cab5cf42256f5c13a3120baa4b055b69df37beb272b89b2340";

const PORT = 5432;

export interface StartedPgBouncer {
  container: StartedTestContainer;
  // crm_app and crm_worker through the pooler, transaction mode.
  appUrl: string;
  workerUrl: string;
  stop(): Promise<void>;
}

// A transaction-mode PgBouncer in front of the test database, as the production pooler runs (spec R6): two server
// connections per role, no prepared statements, SCRAM. It reaches Postgres on the default bridge network.
export async function startPgBouncer(db: TestDatabase): Promise<StartedPgBouncer> {
  const postgresHost = db.container.getIpAddress("bridge");
  const ini = [
    "[databases]",
    `* = host=${postgresHost} port=5432`,
    "",
    "[pgbouncer]",
    "listen_addr = 0.0.0.0",
    `listen_port = ${PORT}`,
    "auth_type = scram-sha-256",
    "auth_file = /etc/pgbouncer/userlist.txt",
    "pool_mode = transaction",
    "default_pool_size = 2",
    "max_prepared_statements = 0",
    "max_client_conn = 100",
    "",
  ].join("\n");
  const userlist = [
    `"crm_app" "${TEST_ROLE_PASSWORDS.app}"`,
    `"crm_worker" "${TEST_ROLE_PASSWORDS.worker}"`,
    "",
  ].join("\n");
  const container = await new GenericContainer(PGBOUNCER_IMAGE)
    .withExposedPorts(PORT)
    .withCopyContentToContainer([
      { content: ini, target: "/etc/pgbouncer/pgbouncer.ini", mode: 0o644 },
      { content: userlist, target: "/etc/pgbouncer/userlist.txt", mode: 0o644 },
    ])
    .withWaitStrategy(Wait.forLogMessage(/process up/))
    .start();
  const pooled = (url: string) => {
    const parsed = new URL(url);
    parsed.hostname = container.getHost();
    parsed.port = String(container.getMappedPort(PORT));
    return parsed.toString();
  };
  return {
    container,
    appUrl: pooled(roleUrl(db.adminUrl, "crm_app", TEST_ROLE_PASSWORDS.app)),
    workerUrl: pooled(roleUrl(db.adminUrl, "crm_worker", TEST_ROLE_PASSWORDS.worker)),
    async stop() {
      await container.stop();
    },
  };
}
