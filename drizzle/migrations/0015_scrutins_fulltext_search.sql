-- Index GIN fulltext pour la recherche sur les scrutins
-- Couvre title et description avec stemming français
CREATE INDEX IF NOT EXISTS "scrutins_search_idx" ON "scrutins"
  USING GIN (to_tsvector('french', coalesce("title", '') || ' ' || coalesce("description", '')));
