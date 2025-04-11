ALTER TABLE "document_embeddings" ADD COLUMN "contextual_summary" text;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD COLUMN "image_file_key" text;