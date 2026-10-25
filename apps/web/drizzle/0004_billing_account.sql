CREATE TABLE "billing_account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_account_owner_user_id_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "billing_account_plan_check" CHECK ("billing_account"."plan" = 'free'),
	CONSTRAINT "billing_account_status_check" CHECK ("billing_account"."status" = 'active')
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_account_id" uuid;--> statement-breakpoint
ALTER TABLE "billing_account" ADD CONSTRAINT "billing_account_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_billing_account_id_billing_account_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_account"("id") ON DELETE restrict ON UPDATE no action;