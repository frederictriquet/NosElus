CREATE TABLE IF NOT EXISTS "law_text_skip_list" (
	"law_id" varchar(50) PRIMARY KEY NOT NULL,
	"reason" varchar(30) NOT NULL,
	"best_score" real,
	"best_match_title" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"threshold" real
);
--> statement-breakpoint
DROP INDEX IF EXISTS "law_summaries_tags_idx";--> statement-breakpoint
ALTER TABLE "scrutins" ALTER COLUMN "law_id" SET DATA TYPE varchar(50);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'law_text_skip_list_law_id_laws_id_fk'
  ) THEN
    ALTER TABLE "law_text_skip_list" ADD CONSTRAINT "law_text_skip_list_law_id_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "law_summaries" DROP COLUMN IF EXISTS "tags";