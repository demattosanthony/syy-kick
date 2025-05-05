CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"instructions" text,
	"model" varchar(255) NOT NULL,
	"active_tools" text[],
	"required_tools" text[],
	"form_schema" jsonb,
	"type" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_step_id" uuid NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"mime_type" varchar(255),
	"file_key" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_step_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_step_id" uuid,
	"role" text NOT NULL,
	"text" text,
	"reasoning" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_step_messages_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_step_message_id" uuid,
	"file_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_step_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_step_message_id" uuid,
	"function_name" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"args" jsonb,
	"status" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid,
	"workflow_step_id" uuid,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_steps_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_step_id" uuid,
	"parent_step_id" uuid,
	"type" text NOT NULL,
	"key" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_steps_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_step_id" uuid,
	"file_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"agent_id" uuid,
	"name" varchar(255),
	"description" text,
	"instructions" text,
	"model" varchar(255),
	"active_tools" text[],
	"form_schema" jsonb,
	"parent_step_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_files" ADD CONSTRAINT "workflow_files_workflow_run_step_id_workflow_run_steps_id_fk" FOREIGN KEY ("workflow_run_step_id") REFERENCES "public"."workflow_run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_files" ADD CONSTRAINT "workflow_files_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_step_messages" ADD CONSTRAINT "workflow_run_step_messages_workflow_run_step_id_workflow_run_steps_id_fk" FOREIGN KEY ("workflow_run_step_id") REFERENCES "public"."workflow_run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_step_messages_documents" ADD CONSTRAINT "workflow_run_step_messages_documents_workflow_run_step_message_id_workflow_run_step_messages_id_fk" FOREIGN KEY ("workflow_run_step_message_id") REFERENCES "public"."workflow_run_step_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_step_messages_documents" ADD CONSTRAINT "workflow_run_step_messages_documents_file_id_workflow_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."workflow_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_step_tool_calls" ADD CONSTRAINT "workflow_run_step_tool_calls_workflow_run_step_message_id_workflow_run_step_messages_id_fk" FOREIGN KEY ("workflow_run_step_message_id") REFERENCES "public"."workflow_run_step_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_workflow_step_id_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_inputs" ADD CONSTRAINT "workflow_run_steps_inputs_workflow_run_step_id_workflow_run_steps_id_fk" FOREIGN KEY ("workflow_run_step_id") REFERENCES "public"."workflow_run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_inputs" ADD CONSTRAINT "workflow_run_steps_inputs_parent_step_id_workflow_run_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."workflow_run_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_outputs" ADD CONSTRAINT "workflow_run_steps_outputs_workflow_run_step_id_workflow_run_steps_id_fk" FOREIGN KEY ("workflow_run_step_id") REFERENCES "public"."workflow_run_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_steps_outputs" ADD CONSTRAINT "workflow_run_steps_outputs_file_id_workflow_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."workflow_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_parent_step_id_workflow_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;