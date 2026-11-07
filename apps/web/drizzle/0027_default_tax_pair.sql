-- No existing row can violate it: onboarding (0026) writes the default tax name and rate together, and 0024's CHECK
-- keeps both null on a workspace that is not tax-registered.
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_tax_pair_check" CHECK (("workspace_settings"."default_tax_name" is null) = ("workspace_settings"."default_tax_rate_bps" is null));