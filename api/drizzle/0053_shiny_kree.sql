ALTER TABLE "workflow_run_steps" DROP CONSTRAINT "workflow_run_steps_workflow_step_id_workflow_steps_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD COLUMN "model" varchar(255);--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD COLUMN "active_tools" text[];--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD COLUMN "form_schema" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_workflow_step_id_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE no action ON UPDATE no action;