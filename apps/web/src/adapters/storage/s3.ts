import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { type StorageAdapter, type StorageConfig, StorageError, type StoredObject } from "./types";

// Every stored object is a download, never a page (FILE-04): stored with this, so a direct GET answers with it too.
const ATTACHMENT = "attachment";

const statusOf = (error: S3ServiceException) => error.$metadata.httpStatusCode ?? error.name;

// A missing key is only the NoSuchKey code. Every other 404 (NoSuchBucket above all) is an outage, not an absence, so
// it throws (PR #62 review R1).
const isMissingKey = (error: unknown) => error instanceof S3ServiceException && error.name === "NoSuchKey";

// A HEAD answer has no body, so S3, R2 and MinIO all report a missing key and a missing bucket as the same bodyless
// 404, which the SDK names NotFound. It is settled by a GET, whose error body carries the code.
const isBodylessNotFound = (error: unknown) =>
  error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404 && error.name === "NotFound";

function fail(operation: StorageError["operation"], error: unknown): never {
  if (error instanceof S3ServiceException) throw new StorageError(operation, statusOf(error));
  // A network or client error: its name only (its message can hold the endpoint).
  throw new StorageError(operation, error instanceof Error ? error.name : "unknown");
}

export function createS3Adapter(config: StorageConfig): StorageAdapter {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const Bucket = config.bucket;

  async function getObject(key: string, operation: "get" | "head"): Promise<StoredObject | null> {
    try {
      const object = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!object.Body) throw new StorageError(operation, "empty body");
      return {
        body: object.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        contentType: object.ContentType ?? "application/octet-stream",
        contentLength: object.ContentLength ?? 0,
      };
    } catch (error) {
      if (error instanceof StorageError) throw error;
      if (isMissingKey(error)) return null;
      fail(operation, error);
    }
  }

  return {
    async put(key, body, contentType, options = {}) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            ContentDisposition: ATTACHMENT,
            // Conditional create (S3 conditional writes; verified against MinIO by s3.contract.test.ts).
            IfNoneMatch: options.ifNoneMatch ? "*" : undefined,
          }),
        );
        return { created: true };
      } catch (error) {
        // 412: the key exists and was left as it is. A 409 (a concurrent conditional write) is a failure the caller
        // may retry; it is not reported as "exists".
        if (options.ifNoneMatch && error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412) {
          return { created: false };
        }
        fail("put", error);
      }
    },

    async get(key) {
      return getObject(key, "get");
    },

    async head(key) {
      try {
        const object = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { contentType: object.ContentType ?? "application/octet-stream", contentLength: object.ContentLength ?? 0 };
      } catch (error) {
        if (!isBodylessNotFound(error)) fail("head", error);
      }
      const object = await getObject(key, "head");
      if (!object) return null;
      // Created between the two requests: report it, and do not download it.
      await object.body.cancel();
      return { contentType: object.contentType, contentLength: object.contentLength };
    },
  };
}
