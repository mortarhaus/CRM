// The storage adapter (Phase 2 plan Task 10): S3-compatible object storage (S3, R2, MinIO) behind one interface.
// There is no delete: nothing in Phase 2 may remove an object (the DuitNow QR is never deleted, spec line 847; a
// replaced logo stays until the Phase 9 purge). The purge adds its own method, with the QR prefix excluded.
// There is no signed URL either (PR #62 review R1, FILE-04): S3 and R2 cannot be made to answer a presigned GET with
// X-Content-Type-Options: nosniff, so objects are served through app routes that set it (files/logo). A signed download
// needs a controlled same-origin or edge response (expiry <= 10 minutes, attachment, nosniff), built when first needed.

export interface StorageConfig {
  // Unset for AWS S3 itself (the SDK derives the endpoint from the region); set for R2 and MinIO.
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  // MinIO and some S3-compatible services need path-style URLs (http://host/bucket/key).
  forcePathStyle: boolean;
}

export interface ObjectHead {
  contentType: string;
  contentLength: number;
}

export interface StoredObject extends ObjectHead {
  body: ReadableStream<Uint8Array>;
}

export interface StorageAdapter {
  // Stores the bytes with this content type and Content-Disposition: attachment. With ifNoneMatch, the put is
  // conditional (If-None-Match: *): an existing key is left as it is and the result is { created: false }.
  put(key: string, body: Uint8Array, contentType: string, options?: { ifNoneMatch?: boolean }): Promise<{ created: boolean }>;
  // Null when the key does not exist.
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<ObjectHead | null>;
}

// UNI-09: names the operation and the provider's status or error code only. No key, no endpoint, no credentials and
// no `cause` (an SDK error can carry the request, signed headers included).
export class StorageError extends Error {
  override name = "StorageError";

  constructor(
    readonly operation: "put" | "get" | "head",
    readonly status: number | string,
  ) {
    super(`Storage ${operation} failed: ${status}`);
  }
}
