import { pgTable, varchar, text, timestamp, date, index, integer } from 'drizzle-orm/pg-core';
import { actors } from './actors';
import { laws } from './laws';

export const amendments = pgTable(
	'amendments',
	{
		id: varchar('id', { length: 50 }).primaryKey(), // ex: AMANR5L17PO123456N12
		uid: varchar('uid', { length: 100 }).unique(), // UID Assemblée Nationale
		number: varchar('number', { length: 20 }).notNull(), // Numéro de l'amendement
		lawId: varchar('law_id', { length: 50 }).references(() => laws.id),
		authorId: varchar('author_id', { length: 20 }).references(() => actors.id), // Auteur principal
		legislature: varchar('legislature', { length: 10 }).notNull(),
		// Détails
		article: varchar('article', { length: 50 }), // Article visé
		position: varchar('position', { length: 50 }), // avant, après, sur l'article
		status: varchar('status', { length: 50 }), // déposé, adopté, rejeté, retiré, tombé
		dispositif: text('dispositif'), // Texte de l'amendement
		exposeSommaire: text('expose_sommaire'), // Exposé des motifs
		// Dates
		depositDate: date('deposit_date'),
		examDate: date('exam_date'),
		// Contexte
		sortOrder: integer('sort_order'), // Ordre de discussion
		chamber: varchar('chamber', { length: 20 }).notNull(), // AN ou SENAT
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('amendments_law_id_idx').on(table.lawId),
		index('amendments_author_id_idx').on(table.authorId),
		index('amendments_legislature_idx').on(table.legislature),
		index('amendments_status_idx').on(table.status),
		index('amendments_deposit_date_idx').on(table.depositDate)
	]
);

export type Amendment = typeof amendments.$inferSelect;
export type NewAmendment = typeof amendments.$inferInsert;
