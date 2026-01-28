import { pgTable, varchar, date, text, timestamp, index } from 'drizzle-orm/pg-core';

export const actors = pgTable(
	'actors',
	{
		id: varchar('id', { length: 20 }).primaryKey(), // ex: PA1234
		uid: varchar('uid', { length: 50 }).unique(), // UID Assemblée Nationale
		civility: varchar('civility', { length: 10 }), // M., Mme
		firstName: varchar('first_name', { length: 100 }).notNull(),
		lastName: varchar('last_name', { length: 100 }).notNull(),
		fullName: varchar('full_name', { length: 200 }).notNull(),
		birthDate: date('birth_date'),
		birthPlace: varchar('birth_place', { length: 200 }),
		deathDate: date('death_date'),
		profession: text('profession'),
		photoUrl: text('photo_url'),
		chamber: varchar('chamber', { length: 20 }).notNull(), // 'AN' ou 'SENAT'
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('actors_chamber_idx').on(table.chamber),
		index('actors_last_name_idx').on(table.lastName),
		index('actors_full_name_idx').on(table.fullName)
	]
);

export type Actor = typeof actors.$inferSelect;
export type NewActor = typeof actors.$inferInsert;
