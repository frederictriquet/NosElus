ALTER TABLE "organs" ADD COLUMN "political_position" real;--> statement-breakpoint
CREATE INDEX "organs_political_position_idx" ON "organs" USING btree ("political_position");