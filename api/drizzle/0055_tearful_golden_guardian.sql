CREATE TABLE "workflow_request_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"file_key" varchar(255) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_request_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"title" varchar(255) NOT NULL,
	"details" text NOT NULL,
	"output_description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_request_steps_depends_on" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" uuid,
	"depends_on_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_request_steps_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" uuid,
	"input_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"requested_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_request_inputs" ADD CONSTRAINT "workflow_request_inputs_request_id_workflow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."workflow_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_request_steps" ADD CONSTRAINT "workflow_request_steps_request_id_workflow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."workflow_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_request_steps_depends_on" ADD CONSTRAINT "workflow_request_steps_depends_on_step_id_workflow_request_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_request_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_request_steps_depends_on" ADD CONSTRAINT "workflow_request_steps_depends_on_depends_on_id_workflow_request_steps_id_fk" FOREIGN KEY ("depends_on_id") REFERENCES "public"."workflow_request_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_request_steps_inputs" ADD CONSTRAINT "workflow_request_steps_inputs_step_id_workflow_request_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_request_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_request_steps_inputs" ADD CONSTRAINT "workflow_request_steps_inputs_input_id_workflow_request_inputs_id_fk" FOREIGN KEY ("input_id") REFERENCES "public"."workflow_request_inputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_requests" ADD CONSTRAINT "workflow_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;