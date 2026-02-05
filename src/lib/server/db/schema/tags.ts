import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Table de référence des tags disponibles pour catégoriser les lois.
 * Tags fixes définis dans law-analyzer.ts (AVAILABLE_TAGS).
 */
export const tags = pgTable('tags', {
	// Slug unique utilisé comme identifiant (ex: "economie", "environnement")
	slug: varchar('slug', { length: 50 }).primaryKey(),
	// Nom affiché dans l'interface (ex: "Économie", "Environnement")
	name: varchar('name', { length: 100 }).notNull(),
	// Description optionnelle du tag
	description: text('description'),
	// Couleur hex pour affichage (ex: "#3b82f6")
	color: varchar('color', { length: 7 }),
	// Timestamps
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
