CREATE TABLE "step_up" (
	"workspace_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	CONSTRAINT "step_up_pkey" PRIMARY KEY("workspace_id","session_id")
);
--> statement-breakpoint
ALTER TABLE "step_up" ADD CONSTRAINT "step_up_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;