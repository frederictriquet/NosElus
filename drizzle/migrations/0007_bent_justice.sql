ALTER TABLE "scrutins" ADD COLUMN "margin" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "scrutins_margin_idx" ON "scrutins" USING btree ("margin");--> statement-breakpoint
-- Calcul rétroactif des marges pour tous les scrutins existants
UPDATE "scrutins" SET "margin" = ABS("total_for" - "total_against");