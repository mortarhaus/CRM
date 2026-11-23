CREATE TABLE "doc_sequence" (
	"workspace_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"pattern" text NOT NULL,
	"reset_rule" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"last_reset_period" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_sequence_pkey" PRIMARY KEY("workspace_id","doc_type"),
	CONSTRAINT "doc_sequence_doc_type_check" CHECK ("doc_sequence"."doc_type" in ('invoice')),
	CONSTRAINT "doc_sequence_pattern_check" CHECK (char_length("doc_sequence"."pattern") between 1 and 50),
	CONSTRAINT "doc_sequence_reset_rule_check" CHECK ("doc_sequence"."reset_rule" in ('never', 'yearly', 'monthly')),
	CONSTRAINT "doc_sequence_counter_check" CHECK ("doc_sequence"."counter" >= 0),
	CONSTRAINT "doc_sequence_last_reset_period_check" CHECK ("doc_sequence"."last_reset_period" ~ '^(never|[0-9]{4}|[0-9]{4}-[0-9]{2})$')
);
--> statement-breakpoint
ALTER TABLE "doc_sequence" ADD CONSTRAINT "doc_sequence_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;