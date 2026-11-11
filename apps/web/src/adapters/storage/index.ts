import { getEnv, storageConfig } from "../../lib/env";
import { createS3Adapter } from "./s3";
import type { StorageAdapter } from "./types";

export { createS3Adapter } from "./s3";
export * from "./types";

let cached: StorageAdapter | null | undefined;

// The app's storage, or null when STORAGE_* is not set (storage off: uploads are refused and nothing is served).
export function getStorage(): StorageAdapter | null {
  if (cached === undefined) {
    const config = storageConfig(getEnv());
    cached = config ? createS3Adapter(config) : null;
  }
  return cached;
}
