ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" timestamp DEFAULT now();
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_count" integer DEFAULT 0 NOT NULL;