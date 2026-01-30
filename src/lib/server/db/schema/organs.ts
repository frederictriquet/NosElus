import { pgTable, varchar, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export const organs = pgTable(
	'organs',
	{
		id: varchar('id', { length: 20 }).primaryKey(), // ex: PO123456
		uid: varchar('uid', { length: 50 }).unique(), // UID Assemblée Nationale
		type: varchar('type', { length: 50 }).notNull(), // GP (groupe parlementaire), COMPER (commission permanente), etc.
		name: varchar('name', { length: 300 }).notNull(),
		shortName: varchar('short_name', { length: 100 }),
		color: varchar('color', { length: 7 }), // Couleur hex pour affichage
		chamber: varchar('chamber', { length: 20 }).notNull(), // 'AN' ou 'SENAT'
		legislature: varchar('legislature', { length: 10 }), // ex: '17'
		startDate: date('start_date'),
		endDate: date('end_date'),
		parentId: varchar('parent_id', { length: 20 }).references((): AnyPgColumn => organs.id),
		description: text('description'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('organs_type_idx').on(table.type),
		index('organs_chamber_idx').on(table.chamber),
		index('organs_legislature_idx').on(table.legislature)
	]
);

export type Organ = typeof organs.$inferSelect;
export type NewOrgan = typeof organs.$inferInsert;
