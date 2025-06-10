CREATE TABLE IF NOT EXISTS "file_page_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_page_id" uuid NOT NULL,
	"content" text NOT NULL,
	"position" integer,
	"embeddings" vector(1024)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_page_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_page_id" uuid NOT NULL,
	"chunk_id" uuid,
	"image_path" text NOT NULL,
	"name" text,
	"embeddings" vector(1024)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"page_number" integer,
	"sheet_name" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer,
	"type" text NOT NULL,
	"file_hash" varchar(255),
	"syyclops_path" text,
	"sharepoint_path" text,
	"google_drive_path" text,
	"file_origin_type" text NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issue_assignees') THEN
        ALTER TABLE "issue_assignees" DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issue_comments') THEN
        ALTER TABLE "issue_comments" DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issues') THEN
        ALTER TABLE "issues" DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_bases') THEN
        ALTER TABLE "knowledge_bases" DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE "projects" DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "issue_assignees" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "issue_comments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "issues" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "knowledge_bases" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "projects" CASCADE;--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'access_logs_project_id_projects_id_fk') THEN
        ALTER TABLE "access_logs" DROP CONSTRAINT "access_logs_project_id_projects_id_fk";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'access_logs_knowledge_base_id_knowledge_bases_id_fk') THEN
        ALTER TABLE "access_logs" DROP CONSTRAINT "access_logs_knowledge_base_id_knowledge_bases_id_fk";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'documents_project_id_projects_id_fk') THEN
        ALTER TABLE "documents" DROP CONSTRAINT "documents_project_id_projects_id_fk";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'documents_knowledge_base_id_knowledge_bases_id_fk') THEN
        ALTER TABLE "documents" DROP CONSTRAINT "documents_knowledge_base_id_knowledge_bases_id_fk";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'member_roles_project_id_projects_id_fk') THEN
        ALTER TABLE "member_roles" DROP CONSTRAINT "member_roles_project_id_projects_id_fk";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'threads_project_id_projects_id_fk') THEN
        ALTER TABLE "threads" DROP CONSTRAINT "threads_project_id_projects_id_fk";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'threads_knowledge_base_id_knowledge_bases_id_fk') THEN
        ALTER TABLE "threads" DROP CONSTRAINT "threads_knowledge_base_id_knowledge_bases_id_fk";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reasoning_duration_seconds') THEN
        ALTER TABLE "messages" ADD COLUMN "reasoning_duration_seconds" integer;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'status') THEN
        ALTER TABLE "messages" ADD COLUMN "status" text DEFAULT 'streaming';
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'error') THEN
        ALTER TABLE "messages" ADD COLUMN "error" text;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'file_page_chunks_file_page_id_file_pages_id_fk') THEN
        ALTER TABLE "file_page_chunks" ADD CONSTRAINT "file_page_chunks_file_page_id_file_pages_id_fk" FOREIGN KEY ("file_page_id") REFERENCES "public"."file_pages"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'file_page_images_file_page_id_file_pages_id_fk') THEN
        ALTER TABLE "file_page_images" ADD CONSTRAINT "file_page_images_file_page_id_file_pages_id_fk" FOREIGN KEY ("file_page_id") REFERENCES "public"."file_pages"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'file_page_images_chunk_id_file_page_chunks_id_fk') THEN
        ALTER TABLE "file_page_images" ADD CONSTRAINT "file_page_images_chunk_id_file_page_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."file_page_chunks"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'file_pages_file_id_files_id_fk') THEN
        ALTER TABLE "file_pages" ADD CONSTRAINT "file_pages_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_files_message_id_messages_id_fk') THEN
        ALTER TABLE "messages_files" ADD CONSTRAINT "messages_files_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_files_file_id_files_id_fk') THEN
        ALTER TABLE "messages_files" ADD CONSTRAINT "messages_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_files_user_id_users_id_fk') THEN
        ALTER TABLE "user_files" ADD CONSTRAINT "user_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_files_file_id_files_id_fk') THEN
        ALTER TABLE "user_files" ADD CONSTRAINT "user_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE c.relname = 'file_page_chunk_embeddings_index' AND n.nspname = 'public') THEN
        CREATE INDEX "file_page_chunk_embeddings_index" ON "file_page_chunks" USING hnsw ("embeddings" vector_cosine_ops);
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE c.relname = 'file_page_image_embeddings_index' AND n.nspname = 'public') THEN
        CREATE INDEX "file_page_image_embeddings_index" ON "file_page_images" USING hnsw ("embeddings" vector_cosine_ops);
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'access_logs' AND column_name = 'project_id') THEN
        ALTER TABLE "access_logs" DROP COLUMN "project_id";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'access_logs' AND column_name = 'knowledge_base_id') THEN
        ALTER TABLE "access_logs" DROP COLUMN "knowledge_base_id";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'project_id') THEN
        ALTER TABLE "documents" DROP COLUMN "project_id";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'knowledge_base_id') THEN
        ALTER TABLE "documents" DROP COLUMN "knowledge_base_id";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_roles' AND column_name = 'project_id') THEN
        ALTER TABLE "member_roles" DROP COLUMN "project_id";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threads' AND column_name = 'project_id') THEN
        ALTER TABLE "threads" DROP COLUMN "project_id";
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threads' AND column_name = 'knowledge_base_id') THEN
        ALTER TABLE "threads" DROP COLUMN "knowledge_base_id";
    END IF;
END $$;