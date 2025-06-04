CREATE TABLE "file_content_chunk_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_content_chunk_id" uuid NOT NULL,
	"image_path" text NOT NULL,
	"ocr_file_name" text,
	"embeddings" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "file_content_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"content" text NOT NULL,
	"page_number" integer,
	"sheet_name" text,
	"embeddings" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer,
	"type" text NOT NULL,
	"syyclops_path" text,
	"sharepoint_path" text,
	"google_drive_path" text,
	"file_origin_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_content_chunk_images" ADD CONSTRAINT "file_content_chunk_images_file_content_chunk_id_file_content_chunks_id_fk" FOREIGN KEY ("file_content_chunk_id") REFERENCES "public"."file_content_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_content_chunks" ADD CONSTRAINT "file_content_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_content_chunk_image_embeddings_index" ON "file_content_chunk_images" USING hnsw ("embeddings" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "file_content_chunk_embeddings_index" ON "file_content_chunks" USING hnsw ("embeddings" vector_cosine_ops);