ALTER TABLE "projects" ADD COLUMN "project_number" varchar(255);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "estimated_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "estimated_end_date" timestamp;