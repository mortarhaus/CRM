import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./index";

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
