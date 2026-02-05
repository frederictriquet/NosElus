-- Migration idempotente pour political_position
-- Utilise IF NOT EXISTS pour être rejouable sans erreur
ALTER TABLE "organs" ADD COLUMN IF NOT EXISTS "political_position" real;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organs_political_position_idx" ON "organs" USING btree ("political_position");
