ALTER TABLE "workflow_run_steps" DROP CONSTRAINT "workflow_run_steps_workflow_step_id_workflow_steps_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_workflow_step_id_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE cascade ON UPDATE no action;