import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("reports ok when the database answers", async () => {
    await expect(checkHealth(async () => {})).resolves.toEqual({
      status: 200,
      body: { status: "ok", db: "ok" },
    });
  });

  it("reports 503 without leaking the database error", async () => {
    const result = await checkHealth(async () => {
      throw new Error('password authentication failed for user "crm"');
    });
    expect(result).toEqual({ status: 503, body: { status: "error", db: "error" } });
    expect(JSON.stringify(result)).not.toContain("password");
  });

  it("reports 503 when the database does not answer in time", async () => {
    const result = await checkHealth(() => new Promise<void>(() => {}), 50);
    expect(result.status).toBe(503);
  });
});
