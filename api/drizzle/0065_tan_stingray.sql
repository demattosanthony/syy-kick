ALTER TABLE "document_embeddings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_processing_jobs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_thumbnails" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_attachments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saml_configs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "document_embeddings" CASCADE;--> statement-breakpoint
DROP TABLE "document_processing_jobs" CASCADE;--> statement-breakpoint
DROP TABLE "document_thumbnails" CASCADE;--> statement-breakpoint
DROP TABLE "documents" CASCADE;--> statement-breakpoint
DROP TABLE "message_attachments" CASCADE;--> statement-breakpoint
DROP TABLE "saml_configs" CASCADE;--> statement-breakpoint
ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "access_logs" DROP COLUMN "document_id";