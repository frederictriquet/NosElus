import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

/**
 * Mots bruit pour la recherche fulltext scrutins :
 * mots que les utilisateurs incluent naturellement dans leurs requêtes ("vote", "voté"...)
 * mais qui n'apparaissent pas dans les titres/descriptions parlementaires officiels.
 * Leur présence dans la requête empêche plainto_tsquery (AND) de trouver des résultats.
 * Géré via l'interface admin /admin/search-noise-words.
 */
export const searchNoiseWords = pgTable('search_noise_words', {
	word: varchar('word', { length: 50 }).primaryKey(), // ex: "vote"
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export type SearchNoiseWord = typeof searchNoiseWords.$inferSelect;
export type NewSearchNoiseWord = typeof searchNoiseWords.$inferInsert;
