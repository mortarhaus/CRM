CREATE TABLE "email_template" (
	"workspace_id" uuid NOT NULL,
	"event" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_template_pkey" PRIMARY KEY("workspace_id","event"),
	CONSTRAINT "email_template_event_check" CHECK ("email_template"."event" in ('invoice_sent', 'payment_reminder', 'payment_receipt', 'payment_voided', 'quote_sent', 'proposal_sent', 'agreement_sent', 'payment_details_changed')),
	CONSTRAINT "email_template_subject_check" CHECK (char_length("email_template"."subject") between 1 and 200),
	CONSTRAINT "email_template_subject_line_check" CHECK ("email_template"."subject" !~ '[\r\n]'),
	CONSTRAINT "email_template_body_check" CHECK (char_length("email_template"."body") between 1 and 5000)
);
--> statement-breakpoint
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;