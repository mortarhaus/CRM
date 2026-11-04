ALTER TABLE "workspace_settings" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "logo_key" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "brand_colour" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "address_city" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "address_postcode" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "address_state" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "country" char(2);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "date_format" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "base_currency" char(3);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "default_currency" char(3);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "tax_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "tax_registration_no" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "own_tin" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "own_brn" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "default_tax_name" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "default_tax_rate_bps" integer;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "tax_rounding" text DEFAULT 'rate_group' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "email_from_name" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "email_reply_to" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "email_bcc_self" boolean;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "auto_send_default" boolean;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "default_agreement_pattern" text DEFAULT 'service_agreement' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "require_2fa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_short_code_check" CHECK ("workspace_settings"."short_code" ~ '^[A-Z0-9]{2,6}$');--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_logo_key_check" CHECK ("workspace_settings"."logo_key" ~ ('^ws/' || "workspace_settings"."workspace_id"::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_brand_colour_check" CHECK ("workspace_settings"."brand_colour" ~ '^#[0-9a-f]{6}$');--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_address_line1_check" CHECK (char_length("workspace_settings"."address_line1") between 1 and 200);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_address_line2_check" CHECK (char_length("workspace_settings"."address_line2") between 1 and 200);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_address_city_check" CHECK (char_length("workspace_settings"."address_city") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_address_postcode_check" CHECK (char_length("workspace_settings"."address_postcode") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_address_state_check" CHECK (char_length("workspace_settings"."address_state") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_country_check" CHECK ("workspace_settings"."country" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_timezone_check" CHECK (char_length("workspace_settings"."timezone") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_locale_check" CHECK (char_length("workspace_settings"."locale") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_date_format_check" CHECK (char_length("workspace_settings"."date_format") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_base_currency_check" CHECK ("workspace_settings"."base_currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_currency_check" CHECK ("workspace_settings"."default_currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_tax_registration_no_check" CHECK (char_length("workspace_settings"."tax_registration_no") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_own_tin_check" CHECK (char_length("workspace_settings"."own_tin") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_own_brn_check" CHECK (char_length("workspace_settings"."own_brn") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_tax_name_check" CHECK (char_length("workspace_settings"."default_tax_name") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_tax_rate_bps_check" CHECK ("workspace_settings"."default_tax_rate_bps" >= 0);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_tax_check" CHECK ("workspace_settings"."tax_registered" or ("workspace_settings"."default_tax_name" is null and "workspace_settings"."default_tax_rate_bps" is null));--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_tax_rounding_check" CHECK ("workspace_settings"."tax_rounding" = 'rate_group');--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_email_from_name_check" CHECK (char_length("workspace_settings"."email_from_name") between 1 and 100);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_email_reply_to_check" CHECK (char_length("workspace_settings"."email_reply_to") between 1 and 254);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_agreement_pattern_check" CHECK ("workspace_settings"."default_agreement_pattern" in ('service_agreement', 'msa_sow'));