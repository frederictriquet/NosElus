import { pgTable, varchar, real, primaryKey, index } from 'drizzle-orm/pg-core';
import { scrutins } from './scrutins';

/**
 * Table de similarité sémantique entre scrutins.
 * Pré-calculée offline par ETL (scripts/etl/generate-similar-scrutins.ts).
 * Permet d'enrichir les résultats de recherche fulltext avec des scrutins
 * sémantiquement proches, sans aucun calcul d'embedding en production.
 *
 * Score : cosine similarity [0–1], 1 = identiques.
 * Seuil recommandé pour les résultats : >= 0.80.
 */
export const scrutinSimilar = pgTable(
	'scrutin_similar',
	{
		scrutinId: varchar('scrutin_id', { length: 20 })
			.notNull()
			.references(() => scrutins.id, { onDelete: 'cascade' }),
		similarId: varchar('similar_id', { length: 20 })
			.notNull()
			.references(() => scrutins.id, { onDelete: 'cascade' }),
		score: real('score').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.scrutinId, table.similarId] }),
		index('scrutin_similar_scrutin_id_idx').on(table.scrutinId)
	]
);

export type ScrutinSimilar = typeof scrutinSimilar.$inferSelect;
export type NewScrutinSimilar = typeof scrutinSimilar.$inferInsert;
