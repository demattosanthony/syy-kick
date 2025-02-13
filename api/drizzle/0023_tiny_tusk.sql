DROP INDEX IF EXISTS "embeddingIndex";
ALTER TABLE "messages" DROP COLUMN "embedding";
ALTER TABLE "messages" ADD COLUMN "embedding" vector(1024);
CREATE INDEX "embeddingIndex" ON "messages" USING hnsw ("embedding" vector_cosine_ops);