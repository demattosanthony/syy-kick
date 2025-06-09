ALTER TABLE "messages" ADD COLUMN "status" text DEFAULT 'streaming';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "error" text;