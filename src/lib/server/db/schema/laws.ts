import { pgTable, varchar, text, timestamp, date, index, jsonb } from 'drizzle-orm/pg-core';

export const laws = pgTable(
	'laws',
	{
		id: varchar('id', { length: 50 }).primaryKey(), // ex: DLR5L17N12345
		uid: varchar('uid', { length: 100 }).unique(), // UID Assemblée Nationale
		number: varchar('number', { length: 50 }), // Numéro du dossier
		legislature: varchar('legislature', { length: 10 }).notNull(),
		title: text('title').notNull(),
		shortTitle: varchar('short_title', { length: 300 }),
		type: varchar('type', { length: 50 }).notNull(), // PJL (projet de loi), PPL (proposition de loi), etc.
		status: varchar('status', { length: 50 }), // en cours, adopté, rejeté, promulgué
		// Dates clés
		depositDate: date('deposit_date'),
		adoptionDateAN: date('adoption_date_an'),
		adoptionDateSenat: date('adoption_date_senat'),
		promulgationDate: date('promulgation_date'),
		publicationDate: date('publication_date'),
		// Contexte
		theme: varchar('theme', { length: 200 }), // Thème principal
		subThemes: jsonb('sub_themes'), // Sous-thèmes (array)
		initiator: varchar('initiator', { length: 50 }), // gouvernement, assemblée, sénat
		description: text('description'),
		sourceUrl: text('source_url'), // Lien vers la source officielle
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('laws_legislature_idx').on(table.legislature),
		index('laws_type_idx').on(table.type),
		index('laws_status_idx').on(table.status),
		index('laws_deposit_date_idx').on(table.depositDate)
	]
);

export type Law = typeof laws.$inferSelect;
export type NewLaw = typeof laws.$inferInsert;
