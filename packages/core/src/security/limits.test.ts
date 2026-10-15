import { describe, expect, it } from "vitest";
import {
  characterCount,
  INVITATION_EXPIRY_SECONDS,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from "./limits";

describe("fixed security values", () => {
  it("keeps the invitation expiry at the spec's 30 minutes", () => {
    expect(INVITATION_EXPIRY_SECONDS).toBe(1800);
  });

  it("keeps the owner's password and name limits (DECISIONS 2026-10-14)", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(15);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(NAME_MAX_LENGTH).toBe(100);
    expect(WORKSPACE_NAME_MAX_LENGTH).toBe(80);
  });
});

describe("characterCount", () => {
  it("counts code points, so a character outside the BMP counts once", () => {
    expect(characterCount("abc")).toBe(3);
    expect(characterCount("🔑🔑")).toBe(2);
    expect("🔑🔑".length).toBe(4);
  });
});
