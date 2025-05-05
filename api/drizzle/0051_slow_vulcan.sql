ALTER TABLE "workflow_run_steps" DROP CONSTRAINT "workflow_run_steps_workflow_step_id_workflow_steps_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_run_steps_inputs_value" DROP CONSTRAINT "workflow_run_steps_inputs_value_workflow_run_step_input_id_workflow_run_steps_inputs_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_workflow_step_id_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_inputs_value" ADD CONSTRAINT "workflow_run_steps_inputs_value_workflow_run_step_input_id_workflow_run_steps_inputs_id_fk" FOREIGN KEY ("workflow_run_step_input_id") REFERENCES "public"."workflow_run_steps_inputs"("id") ON DELETE no action ON UPDATE no action;