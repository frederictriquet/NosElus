-- Add period column to actor_stats
ALTER TABLE "actor_stats" ADD COLUMN IF NOT EXISTS "period" varchar(20) DEFAULT 'all' NOT NULL;

-- Drop old primary key constraint
ALTER TABLE "actor_stats" DROP CONSTRAINT IF EXISTS "actor_stats_actor_id_source_pk";
ALTER TABLE "actor_stats" DROP CONSTRAINT IF EXISTS "actor_stats_pkey";

-- Create new primary key with period
ALTER TABLE "actor_stats" ADD CONSTRAINT "actor_stats_actor_id_source_period_pk" PRIMARY KEY ("actor_id", "source", "period");

-- Add index on period
CREATE INDEX IF NOT EXISTS "actor_stats_period_idx" ON "actor_stats" USING btree ("period");
