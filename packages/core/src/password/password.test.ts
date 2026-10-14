import { describe, expect, it } from "vitest";
import { hashPassword, normalizePassword, verifyPassword } from "./index";

describe("hashPassword", () => {
  it("produces an Argon2id PHC string with the OWASP minimum parameters", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it("salts every hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toBe(second);
  });
});

describe("verifyPassword", () => {
  it("accepts the password that produced the hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "Correct horse battery staple")).resolves.toBe(false);
  });

  it("returns false for a non-Argon2id hash instead of throwing", async () => {
    await expect(verifyPassword("a1b2c3:d4e5f6", "anything")).resolves.toBe(false);
  });

  it("returns false for a corrupted Argon2id hash instead of throwing", async () => {
    await expect(verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$broken", "anything")).resolves.toBe(false);
  });
});

describe("Unicode normalization (NFC, owner decision 2026-10-14)", () => {
  const COMPOSED = "café au lait, s'il vous plaît";
  const DECOMPOSED = "café au lait, s'il vous plaît";

  it("normalizes to NFC, composing a decomposed accent", () => {
    expect(COMPOSED).not.toBe(DECOMPOSED);
    expect(normalizePassword(DECOMPOSED)).toBe(COMPOSED);
    expect(normalizePassword(COMPOSED)).toBe(COMPOSED);
  });

  it("verifies the composed form against a hash of the decomposed form", async () => {
    await expect(verifyPassword(await hashPassword(DECOMPOSED), COMPOSED)).resolves.toBe(true);
  });

  it("verifies the decomposed form against a hash of the composed form", async () => {
    await expect(verifyPassword(await hashPassword(COMPOSED), DECOMPOSED)).resolves.toBe(true);
  });

  it.each([
    ["a full-width letter", "pＡssword phrase 1", "pAssword phrase 1"],
    ["the fi ligature", "ﬁne password phrase", "fine password phrase"],
  ])("does not fold compatibility characters: %s stays a different password", async (_, compatibility, plain) => {
    expect(normalizePassword(compatibility)).toBe(compatibility);
    await expect(verifyPassword(await hashPassword(compatibility), plain)).resolves.toBe(false);
    await expect(verifyPassword(await hashPassword(plain), compatibility)).resolves.toBe(false);
  });

  it("leaves ASCII unchanged", () => {
    const ascii = "correct horse battery staple 42";
    expect(normalizePassword(ascii)).toBe(ascii);
  });
});
