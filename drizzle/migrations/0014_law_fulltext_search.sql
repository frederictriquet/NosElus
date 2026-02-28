-- Index fonctionnel GIN pour full-text search sur les lois
-- Couvre title, description et theme avec la config 'french' pour le stemming
CREATE INDEX IF NOT EXISTS "laws_search_idx" ON "laws"
  USING GIN (to_tsvector('french', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("theme", '')));
