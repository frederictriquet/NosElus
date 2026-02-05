import { pgTable, varchar, primaryKey, index } from 'drizzle-orm/pg-core';
import { laws } from './laws';
import { tags } from './tags';

/**
 * Table de jonction many-to-many entre laws et tags.
 * Permet à une loi d'avoir plusieurs tags et un tag d'être associé à plusieurs lois.
 */
export const lawTags = pgTable(
	'law_tags',
	{
		lawId: varchar('law_id', { length: 50 })
			.notNull()
			.references(() => laws.id, { onDelete: 'cascade' }),
		tagSlug: varchar('tag_slug', { length: 50 })
			.notNull()
			.references(() => tags.slug, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.lawId, table.tagSlug] }),
		// Index pour requêtes "toutes les lois avec tag X"
		index('law_tags_tag_slug_idx').on(table.tagSlug),
		// Index pour requêtes "tous les tags de la loi Y"
		index('law_tags_law_id_idx').on(table.lawId)
	]
);

export type LawTag = typeof lawTags.$inferSelect;
export type NewLawTag = typeof lawTags.$inferInsert;
