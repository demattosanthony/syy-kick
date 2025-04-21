ALTER TABLE "projects" DROP COLUMN IF EXISTS "address";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "city";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "state";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "country";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "postal_code";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "latitude";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "longitude";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN IF EXISTS "slug";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN IF EXISTS "description";
DELETE FROM permissions WHERE resource_id = (SELECT id FROM resources WHERE name = 'org_sites' LIMIT 1);