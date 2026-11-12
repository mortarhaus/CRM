import { randomUUID } from "node:crypto";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import type { StorageConfig } from "../adapters/storage/types";

// MinIO (the pgsty community fork; the official image is no longer published), pinned by tag and index digest like
// docker/compose.dev.yml (UNI-14; docs/DECISIONS.md 2026-11-11).
export const MINIO_IMAGE =
  "pgsty/minio:RELEASE.2026-08-04T00-00-00Z@sha256:b6bfe7239bfc83fb90d31612d9704d86039dd714f7904b3f1ad68f211e602372";

// Fixed values for throwaway test containers only.
const ROOT_USER = "crm-minio-test-only";
const ROOT_PASSWORD = "crm-minio-test-only-secret";

export interface TestMinio {
  container: StartedTestContainer;
  config: StorageConfig;
  stop(): Promise<void>;
}

// A MinIO container named crm-test-minio-<id>, with one empty private bucket.
export async function startMinio(): Promise<TestMinio> {
  const container = await new GenericContainer(MINIO_IMAGE)
    .withName(`crm-test-minio-${randomUUID().slice(0, 8)}`)
    .withCommand(["server", "/data"])
    .withEnvironment({ MINIO_ROOT_USER: ROOT_USER, MINIO_ROOT_PASSWORD: ROOT_PASSWORD })
    .withExposedPorts(9000)
    .withWaitStrategy(Wait.forHttp("/minio/health/ready", 9000))
    .start();
  const config: StorageConfig = {
    endpoint: `http://${container.getHost()}:${container.getMappedPort(9000)}`,
    region: "us-east-1",
    bucket: "crm-test",
    accessKeyId: ROOT_USER,
    secretAccessKey: ROOT_PASSWORD,
    forcePathStyle: true,
  };
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: ROOT_USER, secretAccessKey: ROOT_PASSWORD },
  });
  await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  client.destroy();
  return { container, config, stop: async () => void (await container.stop()) };
}
