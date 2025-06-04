CREATE TABLE "file_page_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_page_id" uuid NOT NULL,
	"content" text NOT NULL,
	"position" integer,
	"embeddings" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "file_page_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_page_id" uuid NOT NULL,
	"chunk_id" uuid,
	"image_path" text NOT NULL,
	"name" text,
	"embeddings" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "file_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"page_number" integer,
	"sheet_name" text
);
--> statement-breakpoint
CREATE TABLE "messages_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_id" uuid NOT NULL
);
--> statement-breakpoint
DROP TABLE "file_content_chunk_images" CASCADE;--> statement-breakpoint
DROP TABLE "file_content_chunks" CASCADE;--> statement-breakpoint
ALTER TABLE "file_page_chunks" ADD CONSTRAINT "file_page_chunks_file_page_id_file_pages_id_fk" FOREIGN KEY ("file_page_id") REFERENCES "public"."file_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_page_images" ADD CONSTRAINT "file_page_images_file_page_id_file_pages_id_fk" FOREIGN KEY ("file_page_id") REFERENCES "public"."file_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_page_images" ADD CONSTRAINT "file_page_images_chunk_id_file_page_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."file_page_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_pages" ADD CONSTRAINT "file_pages_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages_files" ADD CONSTRAINT "messages_files_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages_files" ADD CONSTRAINT "messages_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_page_chunk_embeddings_index" ON "file_page_chunks" USING hnsw ("embeddings" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "file_page_image_embeddings_index" ON "file_page_images" USING hnsw ("embeddings" vector_cosine_ops);