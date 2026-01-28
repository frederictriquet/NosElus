import { pgTable, varchar, date, text, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { actors } from './actors';
import { organs } from './organs';

export const mandates = pgTable(
	'mandates',
	{
		id: varchar('id', { length: 50 }).primaryKey(), // Composite ou UID
		actorId: varchar('actor_id', { length: 20 })
			.notNull()
			.references(() => actors.id),
		organId: varchar('organ_id', { length: 20 })
			.notNull()
			.references(() => organs.id),
		type: varchar('type', { length: 50 }).notNull(), // membre, président, etc.
		quality: varchar('quality', { length: 100 }), // Qualité spécifique (apparenté, etc.)
		startDate: date('start_date').notNull(),
		endDate: date('end_date'),
		// Infos spécifiques aux mandats parlementaires
		legislature: varchar('legislature', { length: 10 }),
		department: varchar('department', { length: 100 }),
		departmentCode: varchar('department_code', { length: 5 }),
		constituency: varchar('constituency', { length: 100 }), // Circonscription
		constituencyNumber: varchar('constituency_number', { length: 5 }),
		electionCause: varchar('election_cause', { length: 100 }), // Cause d'élection
		mandateEndCause: text('mandate_end_cause'), // Cause de fin de mandat
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('mandates_actor_id_idx').on(table.actorId),
		index('mandates_organ_id_idx').on(table.organId),
		index('mandates_type_idx').on(table.type),
		index('mandates_legislature_idx').on(table.legislature),
		index('mandates_dates_idx').on(table.startDate, table.endDate)
	]
);

export type Mandate = typeof mandates.$inferSelect;
export type NewMandate = typeof mandates.$inferInsert;
