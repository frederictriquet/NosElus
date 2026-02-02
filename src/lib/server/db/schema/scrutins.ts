import {
	pgTable,
	varchar,
	text,
	timestamp,
	integer,
	date,
	index,
	jsonb
} from 'drizzle-orm/pg-core';

export const scrutins = pgTable(
	'scrutins',
	{
		id: varchar('id', { length: 20 }).primaryKey(), // ex: VTANR5A2024-1234
		uid: varchar('uid', { length: 50 }).unique(), // UID Assemblée Nationale
		number: integer('number').notNull(), // Numéro du scrutin
		legislature: varchar('legislature', { length: 10 }).notNull(),
		sessionOrdinary: varchar('session_ordinary', { length: 50 }), // Session ordinaire
		sessionExtraordinary: varchar('session_extraordinary', { length: 50 }), // Session extraordinaire
		date: date('date').notNull(),
		title: text('title').notNull(),
		type: varchar('type', { length: 50 }).notNull(), // SPO (solennel), SPS (sur projet), etc.
		sortType: varchar('sort_type', { length: 50 }), // adoption, rejet, etc.
		category: varchar('category', { length: 30 }), // Catégorie sémantique (vote-final, amendement, etc.)
		// Résultats agrégés
		totalVoters: integer('total_voters').notNull().default(0),
		totalFor: integer('total_for').notNull().default(0),
		totalAgainst: integer('total_against').notNull().default(0),
		totalAbstention: integer('total_abstention').notNull().default(0),
		totalNonVoting: integer('total_non_voting').notNull().default(0),
		result: varchar('result', { length: 20 }), // 'adopté', 'rejeté'
		margin: integer('margin').notNull().default(0), // ABS(total_for - total_against) - pré-calculé pour performance
		// Détails par groupe (JSONB pour flexibilité)
		groupResults: jsonb('group_results'), // Résultats détaillés par groupe parlementaire
		// Contexte législatif
		lawId: varchar('law_id', { length: 20 }), // Référence au dossier législatif
		amendmentRef: varchar('amendment_ref', { length: 50 }), // Référence à un amendement si applicable
		description: text('description'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('scrutins_legislature_idx').on(table.legislature),
		index('scrutins_date_idx').on(table.date),
		index('scrutins_type_idx').on(table.type),
		index('scrutins_number_idx').on(table.number),
		index('scrutins_law_id_idx').on(table.lawId),
		index('scrutins_category_idx').on(table.category),
		index('scrutins_margin_idx').on(table.margin)
	]
);

export type Scrutin = typeof scrutins.$inferSelect;
export type NewScrutin = typeof scrutins.$inferInsert;
