-- Migration: table search_noise_words
-- Mots bruit exclus du fulltext scrutins (vote, voté, etc.)

CREATE TABLE IF NOT EXISTS "search_noise_words" (
  "word"       varchar(50) PRIMARY KEY,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Seed initial : mots que les utilisateurs tapent mais absents des titres parlementaires
INSERT INTO "search_noise_words" ("word") VALUES
  ('vote'),
  ('votes'),
  ('voté'),
  ('votés'),
  ('voter'),
  ('résultat'),
  ('résultats')
ON CONFLICT DO NOTHING;
