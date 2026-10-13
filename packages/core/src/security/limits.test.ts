import { describe, expect, it } from "vitest";
import { INVITATION_EXPIRY_SECONDS } from "./limits";

describe("fixed security values", () => {
  it("keeps the invitation expiry at the spec's 30 minutes", () => {
    expect(INVITATION_EXPIRY_SECONDS).toBe(1800);
  });
});
