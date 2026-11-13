import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMinio, type TestMinio } from "../../test/minio";
import { createS3Adapter } from "./s3";
import { type StorageAdapter, StorageError } from "./types";

// Phase 2 plan Task 11: the adapter contract against MinIO (the S3 vs MinIO test deferred from Phase 1, line 1536).
let minio: TestMinio;
let storage: StorageAdapter;

const key = () => `ws/${randomUUID()}/${randomUUID()}`;
const bytes = (text: string) => new TextEncoder().encode(text);

async function read(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

beforeAll(async () => {
  minio = await startMinio();
  storage = createS3Adapter(minio.config);
});

afterAll(async () => {
  await minio?.stop();
});

describe("S3 adapter against MinIO", () => {
  it("round-trips put and get, and head reports the type and length", async () => {
    const name = key();
    expect(await storage.put(name, bytes("hello logo"), "image/png")).toEqual({ created: true });
    const object = await storage.get(name);
    expect(object).toMatchObject({ contentType: "image/png", contentLength: 10 });
    expect(await read(object?.body ?? new ReadableStream())).toBe("hello logo");
    expect(await storage.head(name)).toEqual({ contentType: "image/png", contentLength: 10 });
  });

  it("answers null for a key that does not exist", async () => {
    expect(await storage.get(key())).toBeNull();
    expect(await storage.head(key())).toBeNull();
  });

  it("a conditional put (If-None-Match: *) creates a new key, and never overwrites an existing one", async () => {
    const name = key();
    expect(await storage.put(name, bytes("first"), "image/png", { ifNoneMatch: true })).toEqual({ created: true });
    expect(await storage.put(name, bytes("second, longer"), "image/jpeg", { ifNoneMatch: true })).toEqual({ created: false });
    const object = await storage.get(name);
    expect(object?.contentType).toBe("image/png");
    expect(await read(object?.body ?? new ReadableStream())).toBe("first");
  });

  it("an unconditional put replaces the object (so callers that must not overwrite pass ifNoneMatch)", async () => {
    const name = key();
    await storage.put(name, bytes("first"), "image/png");
    await storage.put(name, bytes("second"), "image/png");
    expect(await read((await storage.get(name))?.body ?? new ReadableStream())).toBe("second");
  });

  it("a provider failure names the operation and status only, never the key or the credentials (UNI-09)", async () => {
    const wrong = createS3Adapter({ ...minio.config, secretAccessKey: "not-the-secret-value" });
    const name = key();
    const error = await wrong.put(name, bytes("x"), "image/png").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toMatchObject({ operation: "put", status: 403 });
    const text = `${String(error)} ${JSON.stringify(error)}`;
    for (const secret of [name, "not-the-secret-value", minio.config.accessKeyId, minio.config.endpoint ?? ""]) {
      expect(text).not.toContain(secret);
    }
    expect((error as Error).cause).toBeUndefined();
  });
});
