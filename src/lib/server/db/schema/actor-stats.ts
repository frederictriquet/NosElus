import { pgTable, varchar, integer, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { actors } from './actors';

/**
 * Statistics about parliamentary activity (attendance, interventions, etc.)
 * Data sourced from NosSénateurs.fr / NosDéputés.fr
 */
export const actorStats = pgTable(
	'actor_stats',
	{
		actorId: varchar('actor_id', { length: 20 })
			.notNull()
			.references(() => actors.id, { onDelete: 'cascade' }),
		source: varchar('source', { length: 50 }).notNull(), // 'nossenateurs', 'nosdeputes'

		// Presence indicators
		weeksPresent: integer('weeks_present').default(0), // semaines_presence
		commissionPresences: integer('commission_presences').default(0),

		// Interventions
		hemicycleInterventions: integer('hemicycle_interventions').default(0),
		hemicycleShortInterventions: integer('hemicycle_short_interventions').default(0),
		commissionInterventions: integer('commission_interventions').default(0),

		// Legislative work
		amendmentsSigned: integer('amendments_signed').default(0),
		amendmentsAdopted: integer('amendments_adopted').default(0),
		reports: integer('reports').default(0),
		writtenProposals: integer('written_proposals').default(0),
		signedProposals: integer('signed_proposals').default(0),
		writtenQuestions: integer('written_questions').default(0),
		oralQuestions: integer('oral_questions').default(0),

		// Metadata
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.actorId, table.source] }),
		index('actor_stats_actor_id_idx').on(table.actorId)
	]
);

export type ActorStats = typeof actorStats.$inferSelect;
export type NewActorStats = typeof actorStats.$inferInsert;
