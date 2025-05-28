ALTER TABLE "workflow_tags" DROP CONSTRAINT "workflow_tags_workflow_id_workflow_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_tags" ADD CONSTRAINT "workflow_tags_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;