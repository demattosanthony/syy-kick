ALTER TABLE "sites" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sites" CASCADE;--> statement-breakpoint
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "site_id";