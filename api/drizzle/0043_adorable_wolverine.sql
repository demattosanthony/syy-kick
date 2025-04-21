ALTER TABLE "projects" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "country";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "postal_code";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "latitude";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "longitude";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN "description";
DELETE FROM permissions WHERE resource_id = (SELECT id FROM resources WHERE name = 'org_sites' LIMIT 1);