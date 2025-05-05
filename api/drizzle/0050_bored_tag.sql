ALTER TABLE "workflow_run_steps" ALTER COLUMN "workflow_step_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_runs" ALTER COLUMN "workflow_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_inputs" ADD COLUMN "label" varchar(255);--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;