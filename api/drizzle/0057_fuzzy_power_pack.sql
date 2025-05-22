ALTER TABLE "agents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_files" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_run_step_messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_run_step_messages_documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_run_step_tool_calls" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_run_steps" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_inputs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_inputs_value" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_outputs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_steps" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "agents" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_files" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_run_step_messages" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_run_step_messages_documents" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_run_step_tool_calls" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_run_steps" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_run_steps_inputs" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_run_steps_inputs_value" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_run_steps_outputs" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_runs" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_steps" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_tags" CASCADE;--> statement-breakpoint
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workflows" ADD COLUMN "mastra_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "workflows" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "workflows" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "workflows" DROP COLUMN "created_by";