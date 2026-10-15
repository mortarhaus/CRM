import { hash, verify, type Algorithm } from "@node-rs/argon2";

// `Algorithm` is an ambient const enum, which isolatedModules forbids as a value; 2 is Argon2id.
const ARGON2ID: Algorithm.Argon2id = 2;

// OWASP Password Storage Cheat Sheet minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane.
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

// Owner decision 2026-10-14 (NIST SP 800-63B-4): NFC, so the same visible password matches whichever
// way a device composed its accents. NFKC is not used: it would fold look-alikes such as "\uff21" to "A".
export function normalizePassword(password: string): string {
  return password.normalize("NFC");
}

export async function hashPassword(password: string): Promise<string> {
  return hash(normalizePassword(password), OPTIONS);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (!storedHash.startsWith("$argon2id$")) return false;
  try {
    return await verify(storedHash, normalizePassword(password));
  } catch {
    return false;
  }
}
