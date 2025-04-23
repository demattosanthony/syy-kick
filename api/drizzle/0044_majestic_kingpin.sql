ALTER TABLE "document_embeddings" ADD COLUMN IF NOT EXISTS "contextual_summary" text;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD COLUMN IF NOT EXISTS "type" text;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD COLUMN IF NOT EXISTS "image_file_key" text;