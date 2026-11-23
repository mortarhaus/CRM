import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { STEP_UP_WINDOW_SECONDS } from "@crm/core/security";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { createDb } from "../db/client";
import { runInWorkspace } from "../db/workspace";

// E2E helpers for the bank-details page (Phase 2 PR 5c). They open their own connections, so they live under src/test
// (TEN-10 lint). Values come from the environment, or else from the repository's .env, which Playwright does not load.
function envValue(name: string): string | undefined {
  const file = path.resolve(__dirname, "../../../../.env");
  return process.env[name] ?? (existsSync(file) ? parseEnv(readFileSync(file, "utf8"))[name] : undefined);
}

function required(name: string): string {
  const value = envValue(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// The user's one workspace, through member as crm_migrator (a system table, no RLS).
export async function workspaceIdOf(email: string): Promise<string> {
  const migrator = postgres(required("DATABASE_MIGRATOR_URL"), { max: 1, onnotice: () => {} });
  try {
    const rows = await migrator<{ organization_id: string }[]>`
      select organization_id from member where user_id = (select id from "user" where email = ${email})`;
    const [row, ...others] = rows;
    if (!row || others.length > 0) throw new Error(`expected one membership, found ${rows.length}`);
    return row.organization_id;
  } finally {
    await migrator.end();
  }
}

// Ages every step-up of the user's workspace past STEP_UP_WINDOW_SECONDS, as if the window ran out while the page was
// open. step_up forces RLS and has no policy for the migrator, so it is changed as crm_app under the workspace.
export async function expireStepUp(email: string): Promise<void> {
  const workspaceId = await workspaceIdOf(email);
  const app = createDb(required("DATABASE_URL"), { max: 1 });
  try {
    const rows = await runInWorkspace(app.db, workspaceId, (tx) =>
      tx.execute(sql`
        update step_up set verified_at = now() - make_interval(secs => ${STEP_UP_WINDOW_SECONDS + 1}) returning session_id`),
    );
    if (rows.length === 0) throw new Error("no step-up to expire");
  } finally {
    await app.sql.end();
  }
}

// Whether an object is in the app's bucket. STORAGE_* as the app gets them; otherwise the dev compose MinIO as the
// host sees it (docker/compose.dev.yml: 127.0.0.1:9100, bucket crm-dev, its dev-only root user).
export async function storedObjectExists(key: string): Promise<boolean> {
  const client = new S3Client({
    endpoint: envValue("STORAGE_ENDPOINT") ?? "http://127.0.0.1:9100",
    region: envValue("STORAGE_REGION") ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: envValue("STORAGE_ACCESS_KEY_ID") ?? "crm-minio-dev-only",
      secretAccessKey: envValue("STORAGE_SECRET_ACCESS_KEY") ?? "crm-minio-dev-only-password",
    },
  });
  try {
    await client.send(new HeadObjectCommand({ Bucket: envValue("STORAGE_BUCKET") ?? "crm-dev", Key: key }));
    return true;
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
    throw error;
  } finally {
    client.destroy();
  }
}
