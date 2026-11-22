ALTER TABLE "workspace_settings" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "bank_account_holder" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "bank_swift_code" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "duitnow_qr_key" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "bank_details_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_bank_name_check" CHECK (char_length("workspace_settings"."bank_name") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_bank_account_holder_check" CHECK (char_length("workspace_settings"."bank_account_holder") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_bank_account_number_check" CHECK (char_length("workspace_settings"."bank_account_number") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_bank_details_check" CHECK (("workspace_settings"."bank_name" is null) = ("workspace_settings"."bank_account_holder" is null) and ("workspace_settings"."bank_name" is null) = ("workspace_settings"."bank_account_number" is null));--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_bank_swift_code_check" CHECK ("workspace_settings"."bank_swift_code" ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$');--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_duitnow_qr_key_check" CHECK ("workspace_settings"."duitnow_qr_key" ~ ('^ws/' || "workspace_settings"."workspace_id"::text || '/duitnow/[0-9a-f]{64}\.(png|jpg)$'));