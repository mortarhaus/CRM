import { IDEMPOTENCY_KEY_MAX_LENGTH } from "@crm/core/security";
import { sql } from "drizzle-orm";
import { check, customType, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

// One row per idempotency key of a workspace (spec Data model `idempotency_key`; plan Task 14), under RLS. action()
// claims the key, runs the handler and stores its response in one transaction; a repeat with the same action and
// request hash replays the response. The spec's "response hash" is kept as the request hash (to refuse reuse of a
// key for other input) plus the response itself (to replay it).
export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    action: text("action").notNull(),
    requestHash: bytea("request_hash").notNull(),
    response: jsonb("response"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "idempotency_key_pkey", columns: [table.workspaceId, table.key] }),
    check(
      "idempotency_key_key_check",
      sql`char_length(${table.key}) between 1 and ${sql.raw(String(IDEMPOTENCY_KEY_MAX_LENGTH))}`,
    ),
  ],
);
