ALTER TABLE "messages" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "embeddingIndex" ON "messages" USING hnsw ("embedding" vector_cosine_ops);