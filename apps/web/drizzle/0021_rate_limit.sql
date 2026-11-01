CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_seconds" integer NOT NULL,
	CONSTRAINT "rate_limit_count_check" CHECK ("rate_limit"."count" >= 0),
	CONSTRAINT "rate_limit_window_seconds_check" CHECK ("rate_limit"."window_seconds" > 0)
);
