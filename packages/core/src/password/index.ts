import { hash, verify, type Algorithm } from "@node-rs/argon2";

// `Algorithm` is an ambient const enum, which isolatedModules forbids as a value; 2 is Argon2id.
const ARGON2ID: Algorithm.Argon2id = 2;

// OWASP Password Storage Cheat Sheet minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane.
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (!storedHash.startsWith("$argon2id$")) return false;
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
