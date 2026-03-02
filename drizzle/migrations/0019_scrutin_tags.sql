-- Migration: table scrutin_tags + tags pilotes pour fiches thématiques
-- Permet de taguer les scrutins directement (y compris ceux sans law_id).
-- Symétrique à law_tags, mais sur les scrutins.

CREATE TABLE IF NOT EXISTS "scrutin_tags" (
  "scrutin_id" varchar(50) NOT NULL REFERENCES "scrutins"("id") ON DELETE CASCADE,
  "tag_slug"   varchar(50) NOT NULL REFERENCES "tags"("slug") ON DELETE CASCADE,
  PRIMARY KEY ("scrutin_id", "tag_slug")
);

CREATE INDEX IF NOT EXISTS "scrutin_tags_tag_slug_idx" ON "scrutin_tags" ("tag_slug");
CREATE INDEX IF NOT EXISTS "scrutin_tags_scrutin_id_idx" ON "scrutin_tags" ("scrutin_id");

-- Tags pilotes pour les fiches thématiques
INSERT INTO "tags" ("slug", "name", "color") VALUES
  ('pouvoir-achat', 'Pouvoir d''achat', '#f59e0b'),
  ('retraites',     'Retraites',        '#8b5cf6')
ON CONFLICT ("slug") DO NOTHING;
