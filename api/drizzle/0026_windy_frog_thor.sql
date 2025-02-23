ALTER TABLE "tool_calls" ALTER COLUMN "result" TYPE jsonb USING result::jsonb;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD COLUMN "tool_call_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD COLUMN "args" jsonb;--> statement-breakpoint
ALTER TABLE "tool_calls" DROP COLUMN "function_arguments";