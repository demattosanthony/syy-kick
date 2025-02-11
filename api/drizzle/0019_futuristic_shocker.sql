ALTER TABLE "users" ADD COLUMN "microsoft_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_microsoft_id_unique" UNIQUE("microsoft_id");