CREATE TABLE "document_processing_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"process_after" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "extraction_status";