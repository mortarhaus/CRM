import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { type StorageAdapter, type StorageConfig, StorageError } from "./types";

// Every stored object is a download, never a page (FILE-04): stored with this, so a direct GET answers with it too.
const ATTACHMENT = "attachment";

const statusOf = (error: S3ServiceException) => error.$metadata.httpStatusCode ?? error.name;

// A missing key: 404 on HEAD (no body, so no error code) and NoSuchKey on GET.
const isMissing = (error: unknown) =>
  error instanceof S3ServiceException && (error.$metadata.httpStatusCode === 404 || error.name === "NoSuchKey");

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
      try {
        const object = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        if (!object.Body) throw new StorageError("get", "empty body");
        return {
          body: object.Body.transformToWebStream() as ReadableStream<Uint8Array>,
          contentType: object.ContentType ?? "application/octet-stream",
          contentLength: object.ContentLength ?? 0,
        };
      } catch (error) {
        if (error instanceof StorageError) throw error;
        if (isMissing(error)) return null;
        fail("get", error);
      }
    },

    async head(key) {
      try {
        const object = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { contentType: object.ContentType ?? "application/octet-stream", contentLength: object.ContentLength ?? 0 };
      } catch (error) {
        if (isMissing(error)) return null;
        fail("head", error);
      }
    },
  };
}
