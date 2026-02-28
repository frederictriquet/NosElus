import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Synonymes de recherche : mappe des termes courants (acronymes, noms usuels)
 * vers leur équivalent dans les textes parlementaires officiels.
 * Ex: SMIC → "salaire minimum interprofessionnel de croissance"
 * Géré via l'interface admin /admin/search-synonyms.
 */
export const searchSynonyms = pgTable('search_synonyms', {
	term: varchar('term', { length: 50 }).primaryKey(), // ex: "SMIC"
	expansion: text('expansion').notNull(), // ex: "salaire minimum interprofessionnel..."
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type SearchSynonym = typeof searchSynonyms.$inferSelect;
export type NewSearchSynonym = typeof searchSynonyms.$inferInsert;
