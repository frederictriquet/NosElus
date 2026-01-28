import { pgTable, varchar, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { actors } from './actors';
import { scrutins } from './scrutins';
import { organs } from './organs';

export const votes = pgTable(
	'votes',
	{
		id: varchar('id', { length: 50 }).primaryKey(), // Composite: scrutinId_actorId
		scrutinId: varchar('scrutin_id', { length: 20 })
			.notNull()
			.references(() => scrutins.id),
		actorId: varchar('actor_id', { length: 20 })
			.notNull()
			.references(() => actors.id),
		groupId: varchar('group_id', { length: 20 }).references(() => organs.id), // Groupe au moment du vote
		position: varchar('position', { length: 20 }).notNull(), // 'pour', 'contre', 'abstention', 'non-votant'
		delegation: varchar('delegation', { length: 20 }), // Si vote par délégation
		delegatorId: varchar('delegator_id', { length: 20 }).references(() => actors.id), // Qui a délégué
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('votes_scrutin_id_idx').on(table.scrutinId),
		index('votes_actor_id_idx').on(table.actorId),
		index('votes_group_id_idx').on(table.groupId),
		index('votes_position_idx').on(table.position),
		index('votes_scrutin_actor_idx').on(table.scrutinId, table.actorId)
	]
);

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
