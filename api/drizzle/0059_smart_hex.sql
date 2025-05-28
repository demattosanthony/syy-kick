CREATE TABLE "workflow_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "workflow_run_tags" CASCADE;--> statement-breakpoint
ALTER TABLE "workflow_tags" ADD CONSTRAINT "workflow_tags_workflow_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tags" ADD CONSTRAINT "workflow_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;