import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EnvError,
  migrateEnvFor,
  parseBootstrapEnv,
  parseEnv,
  parseMigrateEnv,
  parseWorkerEnv,
  trustedClientIpHeader,
} from "./env";

const valid = {
  DEPLOYMENT_MODE: "selfhost",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "k".repeat(32),
  DATABASE_URL: "postgres://crm_app:app-password@localhost:5433/crm",
  DATABASE_MIGRATOR_URL: "postgres://crm_migrator:migrator-password@localhost:5433/crm",
};

const production = { ...valid, NODE_ENV: "production", TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip" };

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the parser to throw");
}

describe("parseEnv", () => {
  it("returns the typed values for a complete environment", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("drops unrelated variables", () => {
    expect(parseEnv({ ...valid, PATH: "/usr/bin" })).toEqual(valid);
  });

  it("names every missing variable and points at .env.example when nothing is set", () => {
    const message = messageOf(() => parseEnv({}));
    for (const name of Object.keys(valid)) {
      expect(message).toContain(name);
    }
    expect(message).toContain(".env.example");
  });

  it("rejects a blank AUTH_SECRET, as left by copying .env.example unchanged", () => {
    expect(messageOf(() => parseEnv({ ...valid, AUTH_SECRET: "" }))).toContain(
      "AUTH_SECRET: must be at least 32 characters",
    );
  });

  it("rejects a short AUTH_SECRET without echoing its value", () => {
    const message = messageOf(() => parseEnv({ ...valid, AUTH_SECRET: "short-secret-value" }));
    expect(message).toContain("AUTH_SECRET: must be at least 32 characters");
    expect(message).not.toContain("short-secret-value");
  });

  it("rejects an unknown DEPLOYMENT_MODE", () => {
    expect(messageOf(() => parseEnv({ ...valid, DEPLOYMENT_MODE: "cloud" }))).toContain("DEPLOYMENT_MODE");
  });

  it("rejects a non-Postgres DATABASE_URL without echoing the URL", () => {
    const message = messageOf(() => parseEnv({ ...valid, DATABASE_URL: "mysql://user:hunter2@db/crm" }));
    expect(message).toContain("DATABASE_URL: must be a postgres:// URL");
    expect(message).not.toContain("hunter2");
  });

  it("refuses a plain-http public APP_URL in production, naming the variable but not the value", () => {
    const message = messageOf(() =>
      parseEnv({ ...valid, NODE_ENV: "production", APP_URL: "http://crm.example.test" }),
    );
    expect(message).toContain("APP_URL: must be an https:// URL in production");
    expect(message).not.toContain("crm.example.test");
  });

  it("accepts an https APP_URL in production", () => {
    expect(parseEnv({ ...production, APP_URL: "https://crm.example.test" }).APP_URL).toBe(
      "https://crm.example.test",
    );
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"])(
    "accepts the loopback origin %s over http in production",
    (appUrl) => {
      expect(parseEnv({ ...production, APP_URL: appUrl }).APP_URL).toBe(appUrl);
    },
  );

  it("requires TRUSTED_CLIENT_IP_HEADER in production, naming it", () => {
    const withoutHeader = { ...production, TRUSTED_CLIENT_IP_HEADER: undefined };
    expect(messageOf(() => parseEnv(withoutHeader))).toContain("TRUSTED_CLIENT_IP_HEADER: must be set in production");
  });

  it.each(["cf-connecting-ip", "x-forwarded-for", "none"])("accepts TRUSTED_CLIENT_IP_HEADER=%s", (value) => {
    expect(parseEnv({ ...production, TRUSTED_CLIENT_IP_HEADER: value }).TRUSTED_CLIENT_IP_HEADER).toBe(value);
  });

  it("rejects any other TRUSTED_CLIENT_IP_HEADER", () => {
    expect(messageOf(() => parseEnv({ ...valid, TRUSTED_CLIENT_IP_HEADER: "x-real-ip" }))).toContain(
      "TRUSTED_CLIENT_IP_HEADER",
    );
  });

  it("defaults the client-IP setting to none outside production", () => {
    expect(trustedClientIpHeader(parseEnv(valid))).toBe("none");
    expect(trustedClientIpHeader(parseEnv({ ...valid, TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for" }))).toBe(
      "x-forwarded-for",
    );
  });

  it("accepts a loopback http APP_URL in development", () => {
    expect(parseEnv({ ...valid, NODE_ENV: "development", APP_URL: "http://localhost:3000" }).APP_URL).toBe(
      "http://localhost:3000",
    );
  });
});

describe("parseWorkerEnv", () => {
  const worker = { ...valid, DATABASE_WORKER_URL: "postgres://crm_worker:worker-password@localhost:5433/crm" };

  it("returns the web values plus the worker's pg-boss connection", () => {
    expect(parseWorkerEnv(worker)).toEqual(worker);
  });

  it("requires DATABASE_WORKER_URL, which the web process does not", () => {
    expect(parseEnv(valid)).toEqual(valid);
    expect(messageOf(() => parseWorkerEnv(valid))).toContain("DATABASE_WORKER_URL");
  });

  it("rejects a non-Postgres DATABASE_WORKER_URL without echoing the URL", () => {
    const message = messageOf(() => parseWorkerEnv({ ...worker, DATABASE_WORKER_URL: "mysql://w:hunter2@db/crm" }));
    expect(message).toContain("DATABASE_WORKER_URL: must be a postgres:// URL");
    expect(message).not.toContain("hunter2");
  });

  it("keeps the production APP_URL rule", () => {
    expect(
      messageOf(() => parseWorkerEnv({ ...worker, NODE_ENV: "production", APP_URL: "http://crm.example.test" })),
    ).toContain("APP_URL: must be an https:// URL in production");
  });
});

// The image runs `migrate.mjs` before the web server and before the worker (docker/entrypoint.sh), so the migration
// step gets each container's environment. CI run 41289663599 (PR #48): the worker container has no
// TRUSTED_CLIENT_IP_HEADER (a web-only setting), and migrate parsed the web schema, so the worker exited 1.
describe("parseMigrateEnv", () => {
  const workerContainer = {
    ...valid,
    NODE_ENV: "production",
    DATABASE_WORKER_URL: "postgres://crm_worker:worker-password@localhost:5433/crm",
  };

  it("accepts the worker container's environment in production (no web-only setting)", () => {
    expect(parseMigrateEnv(workerContainer)).toEqual({ DATABASE_MIGRATOR_URL: valid.DATABASE_MIGRATOR_URL });
  });

  it("needs only DATABASE_MIGRATOR_URL", () => {
    expect(parseMigrateEnv({ DATABASE_MIGRATOR_URL: valid.DATABASE_MIGRATOR_URL })).toEqual({
      DATABASE_MIGRATOR_URL: valid.DATABASE_MIGRATOR_URL,
    });
    expect(messageOf(() => parseMigrateEnv({}))).toContain("DATABASE_MIGRATOR_URL");
  });

  it("rejects a non-Postgres DATABASE_MIGRATOR_URL without echoing the URL", () => {
    const message = messageOf(() => parseMigrateEnv({ DATABASE_MIGRATOR_URL: "mysql://m:hunter2@db/crm" }));
    expect(message).toContain("DATABASE_MIGRATOR_URL: must be a postgres:// URL");
    expect(message).not.toContain("hunter2");
  });

  // The entrypoint passes the container's role, so each container is still checked in full at start and exits 1
  // before it listens or works (docs/runbooks/phase-0-auth-database.md), against its own variables only.
  it("checks the container's own schema: the worker container passes without the web-only setting", () => {
    expect(migrateEnvFor("worker", workerContainer)).toEqual({ DATABASE_MIGRATOR_URL: valid.DATABASE_MIGRATOR_URL });
    expect(messageOf(() => migrateEnvFor("worker", { ...workerContainer, DATABASE_WORKER_URL: undefined }))).toContain(
      "DATABASE_WORKER_URL",
    );
  });

  it("checks the container's own schema: the web container still needs TRUSTED_CLIENT_IP_HEADER in production", () => {
    expect(messageOf(() => migrateEnvFor("web", workerContainer))).toContain("TRUSTED_CLIENT_IP_HEADER");
    expect(migrateEnvFor("web", production)).toEqual({ DATABASE_MIGRATOR_URL: valid.DATABASE_MIGRATOR_URL });
  });

  it("a standalone migration (no role) needs only its own connection", () => {
    expect(migrateEnvFor(undefined, { DATABASE_MIGRATOR_URL: valid.DATABASE_MIGRATOR_URL })).toEqual({
      DATABASE_MIGRATOR_URL: valid.DATABASE_MIGRATOR_URL,
    });
  });

  it("the migrate and worker entry points never parse the web schema", () => {
    for (const entry of ["../../migrate.ts", "../../worker.ts"]) {
      const source = readFileSync(new URL(entry, import.meta.url), "utf8");
      expect(source, entry).not.toMatch(/\bgetEnv\(|\bparseEnv\(/);
    }
    expect(readFileSync(new URL("../../../../docker/entrypoint.sh", import.meta.url), "utf8")).toMatch(
      /web\)\n\s+node dist\/migrate\.mjs web\n[\s\S]*worker\)\n\s+node dist\/migrate\.mjs worker\n/,
    );
  });
});

describe("parseBootstrapEnv", () => {
  const bootstrap = {
    DATABASE_ADMIN_URL: "postgres://postgres:admin-password@localhost:5433/crm",
    CRM_MIGRATOR_PASSWORD: "m".repeat(16),
    CRM_APP_PASSWORD: "a".repeat(16),
    CRM_WORKER_PASSWORD: "w".repeat(16),
  };

  it("needs no crm_purge password, and takes one when given", () => {
    expect(parseBootstrapEnv(bootstrap)).toEqual(bootstrap);
    expect(parseBootstrapEnv({ ...bootstrap, CRM_PURGE_PASSWORD: "p".repeat(16) }).CRM_PURGE_PASSWORD).toBe(
      "p".repeat(16),
    );
  });

  it("names every missing variable", () => {
    const message = messageOf(() => parseBootstrapEnv({}));
    for (const name of Object.keys(bootstrap)) {
      expect(message).toContain(name);
    }
  });

  it.each(["CRM_MIGRATOR_PASSWORD", "CRM_APP_PASSWORD", "CRM_WORKER_PASSWORD", "CRM_PURGE_PASSWORD"])(
    "refuses a %s under 16 characters without echoing it",
    (name) => {
      const message = messageOf(() => parseBootstrapEnv({ ...bootstrap, [name]: "short-pw-value" }));
      expect(message).toContain(`${name}: must be at least 16 characters`);
      expect(message).not.toContain("short-pw-value");
    },
  );

  it("refuses a password with a character outside printable ASCII without echoing it", () => {
    const value = "pässwort-sixteen-chars";
    const message = messageOf(() => parseBootstrapEnv({ ...bootstrap, CRM_APP_PASSWORD: value }));
    expect(message).toContain("CRM_APP_PASSWORD: must use printable ASCII characters only");
    expect(message).not.toContain(value);
  });

  it("rejects a non-Postgres DATABASE_ADMIN_URL without echoing the URL", () => {
    const message = messageOf(() => parseBootstrapEnv({ ...bootstrap, DATABASE_ADMIN_URL: "mysql://a:hunter2@db/crm" }));
    expect(message).toContain("DATABASE_ADMIN_URL: must be a postgres:// URL");
    expect(message).not.toContain("hunter2");
  });
});
