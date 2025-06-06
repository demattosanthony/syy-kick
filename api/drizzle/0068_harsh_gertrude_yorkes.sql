ALTER TABLE "knowledge_bases" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "knowledge_bases" CASCADE;--> statement-breakpoint
ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_knowledge_base_id_knowledge_bases_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_knowledge_base_id_knowledge_bases_id_fk";
--> statement-breakpoint
ALTER TABLE "threads" DROP CONSTRAINT IF EXISTS "threads_knowledge_base_id_knowledge_bases_id_fk";
--> statement-breakpoint
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "knowledge_base_id";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "knowledge_base_id";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN IF EXISTS "knowledge_base_id";