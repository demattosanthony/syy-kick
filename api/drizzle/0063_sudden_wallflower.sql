ALTER TABLE "projects" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "projects" CASCADE;--> statement-breakpoint
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'access_logs_project_id_projects_id_fk') THEN
        ALTER TABLE "access_logs" DROP CONSTRAINT "access_logs_project_id_projects_id_fk";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'documents_project_id_projects_id_fk') THEN
        ALTER TABLE "documents" DROP CONSTRAINT "documents_project_id_projects_id_fk";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'member_roles_project_id_projects_id_fk') THEN
        ALTER TABLE "member_roles" DROP CONSTRAINT "member_roles_project_id_projects_id_fk";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'threads_project_id_projects_id_fk') THEN
        ALTER TABLE "threads" DROP CONSTRAINT "threads_project_id_projects_id_fk";
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "access_logs" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "member_roles" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "project_id";