CREATE TABLE "idempotency_key" (
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"action" text NOT NULL,
	"request_hash" "bytea" NOT NULL,
	"response" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_key_pkey" PRIMARY KEY("workspace_id","key"),
	CONSTRAINT "idempotency_key_key_check" CHECK (char_length("idempotency_key"."key") between 1 and 128)
);
--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;