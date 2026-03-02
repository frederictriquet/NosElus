-- Migration: champ title_simple sur la table scrutins
-- Titre en français courant pour les cartes de vote partageables (nullable)

ALTER TABLE "scrutins" ADD COLUMN IF NOT EXISTS "title_simple" varchar(300);
