ALTER TABLE "users" ALTER COLUMN "subscription_plan" SET DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "subscription_status" text DEFAULT 'incomplete';--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_stripe_customer_id_unique" UNIQUE("stripe_customer_id");