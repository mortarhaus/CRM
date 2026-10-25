CREATE TABLE "auth_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"detail" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_audit_log_event_check" CHECK ("auth_audit_log"."event" in ('session_issued', 'two_factor_verified', 'two_factor_enabled', 'two_factor_disabled', 'two_factor_backup_codes_changed')),
	CONSTRAINT "auth_audit_log_detail_check" CHECK ("auth_audit_log"."detail" is null or jsonb_typeof("auth_audit_log"."detail") = 'object')
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "issue_reason" text;--> statement-breakpoint
ALTER TABLE "auth_audit_log" ADD CONSTRAINT "auth_audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_audit_log_user_id_created_at_idx" ON "auth_audit_log" USING btree ("user_id","created_at");