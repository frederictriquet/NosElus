CREATE TABLE "law_tags" (
	"law_id" varchar(50) NOT NULL,
	"tag_slug" varchar(50) NOT NULL,
	CONSTRAINT "law_tags_law_id_tag_slug_pk" PRIMARY KEY("law_id","tag_slug")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"slug" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "law_tags" ADD CONSTRAINT "law_tags_law_id_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_tags" ADD CONSTRAINT "law_tags_tag_slug_tags_slug_fk" FOREIGN KEY ("tag_slug") REFERENCES "public"."tags"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "law_tags_tag_slug_idx" ON "law_tags" USING btree ("tag_slug");--> statement-breakpoint
CREATE INDEX "law_tags_law_id_idx" ON "law_tags" USING btree ("law_id");--> statement-breakpoint
-- Peupler la table tags avec tous les tags utilisés dans les données
INSERT INTO "tags" ("slug", "name", "description", "color") VALUES
	('economie', 'Économie', 'Lois relatives à l''économie, au budget, aux finances publiques', '#3b82f6'),
	('environnement', 'Environnement', 'Lois sur l''écologie, le climat, la biodiversité', '#10b981'),
	('sante', 'Santé', 'Lois concernant le système de santé, les hôpitaux, la sécurité sociale', '#ef4444'),
	('travail', 'Travail', 'Lois sur l''emploi, le droit du travail, les syndicats', '#f59e0b'),
	('justice', 'Justice', 'Lois sur le système judiciaire, le droit pénal, la police', '#8b5cf6'),
	('education', 'Éducation', 'Lois relatives à l''enseignement, les universités, la formation', '#06b6d4'),
	('defense', 'Défense', 'Lois sur l''armée, la sécurité nationale, la défense', '#dc2626'),
	('agriculture', 'Agriculture', 'Lois concernant l''agriculture, la pêche, la ruralité', '#84cc16'),
	('logement', 'Logement', 'Lois sur le logement, l''urbanisme, la construction', '#f97316'),
	('transports', 'Transports', 'Lois relatives aux transports, infrastructures, mobilité', '#0ea5e9'),
	('culture', 'Culture', 'Lois sur la culture, le patrimoine, les médias', '#ec4899'),
	('social', 'Social', 'Lois sur la protection sociale, les retraites, la famille', '#14b8a6'),
	('numerique', 'Numérique', 'Lois relatives au numérique, aux données, à l''IA', '#6366f1'),
	('immigration', 'Immigration', 'Lois sur l''immigration, l''asile, la nationalité', '#a855f7'),
	('energie', 'Énergie', 'Lois sur l''énergie, le nucléaire, les énergies renouvelables', '#facc15'),
	('recherche', 'Recherche', 'Lois relatives à la recherche scientifique et l''innovation', '#22d3ee'),
	('collectivites', 'Collectivités', 'Lois sur les collectivités territoriales, la décentralisation', '#a3e635'),
	('fiscalite', 'Fiscalité', 'Lois fiscales, impôts, taxes', '#eab308'),
	('international', 'International', 'Traités internationaux, relations internationales', '#0891b2'),
	('securite', 'Sécurité', 'Lois sur la sécurité publique, la police, la criminalité', '#991b1b');--> statement-breakpoint
-- Migrer les tags JSONB existants vers law_tags (normaliser les slugs sans accents)
-- Utilise unaccent pour supprimer tous les accents automatiquement
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
INSERT INTO "law_tags" ("law_id", "tag_slug")
SELECT
	ls.law_id,
	lower(unaccent(tag_value)) as tag_slug
FROM "law_summaries" ls
CROSS JOIN LATERAL jsonb_array_elements_text(ls.tags) AS tag_value
WHERE ls.tags IS NOT NULL AND jsonb_array_length(ls.tags) > 0;--> statement-breakpoint
-- Supprimer l'index GIN sur law_summaries.tags
DROP INDEX IF EXISTS "law_summaries_tags_idx";--> statement-breakpoint
-- Supprimer la colonne tags de law_summaries
ALTER TABLE "law_summaries" DROP COLUMN "tags";