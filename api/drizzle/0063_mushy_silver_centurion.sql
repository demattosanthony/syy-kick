ALTER TABLE "threads" DROP CONSTRAINT "threads_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "workflow_id";