import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env";

const valid = {
  DEPLOYMENT_MODE: "selfhost",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "k".repeat(32),
  DATABASE_URL: "postgres://crm:crm@localhost:5433/crm",
  DATABASE_MIGRATOR_URL: "postgres://crm:crm@localhost:5433/crm",
};

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected parseEnv to throw");
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
});
