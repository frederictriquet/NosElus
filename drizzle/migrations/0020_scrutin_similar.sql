-- Migration: table scrutin_similar — voisins sémantiques pré-calculés
-- Permet d'enrichir la recherche fulltext avec des scrutins sémantiquement proches.
-- Pré-calculée offline via scripts/etl/generate-similar-scrutins.ts.
-- Zéro pgvector ni embedding en production : simple JOIN SQL.

CREATE TABLE IF NOT EXISTS "scrutin_similar" (
  "scrutin_id" varchar(20) NOT NULL REFERENCES "scrutins"("id") ON DELETE CASCADE,
  "similar_id" varchar(20) NOT NULL REFERENCES "scrutins"("id") ON DELETE CASCADE,
  "score"      real        NOT NULL,
  PRIMARY KEY ("scrutin_id", "similar_id")
);

CREATE INDEX IF NOT EXISTS "scrutin_similar_scrutin_id_idx" ON "scrutin_similar" ("scrutin_id");
