import { pgTable, varchar, primaryKey, index } from 'drizzle-orm/pg-core';
import { scrutins } from './scrutins';
import { tags } from './tags';

/**
 * Table de jonction many-to-many entre scrutins et tags.
 * Permet de taguer directement les scrutins (y compris ceux sans law_id).
 * Symétrique à law_tags, mais sur les scrutins.
 */
export const scrutinTags = pgTable(
	'scrutin_tags',
	{
		scrutinId: varchar('scrutin_id', { length: 50 })
			.notNull()
			.references(() => scrutins.id, { onDelete: 'cascade' }),
		tagSlug: varchar('tag_slug', { length: 50 })
			.notNull()
			.references(() => tags.slug, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.scrutinId, table.tagSlug] }),
		// Index pour requêtes "tous les scrutins avec tag X" (fiche thématique)
		index('scrutin_tags_tag_slug_idx').on(table.tagSlug),
		// Index pour requêtes "tous les tags d'un scrutin Y"
		index('scrutin_tags_scrutin_id_idx').on(table.scrutinId)
	]
);

export type ScrutinTag = typeof scrutinTags.$inferSelect;
export type NewScrutinTag = typeof scrutinTags.$inferInsert;
