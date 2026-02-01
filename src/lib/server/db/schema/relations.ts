import { relations } from 'drizzle-orm';
import { actors } from './actors';
import { organs } from './organs';
import { mandates } from './mandates';
import { scrutins } from './scrutins';
import { votes } from './votes';
import { laws } from './laws';
import { amendments } from './amendments';
import { lawCosignatories } from './law-cosignatories';

// Relations pour actors
export const actorsRelations = relations(actors, ({ many }) => ({
	mandates: many(mandates),
	votes: many(votes, { relationName: 'actorVotes' }),
	delegatedVotes: many(votes, { relationName: 'delegation' }),
	amendments: many(amendments)
}));

// Relations pour organs
export const organsRelations = relations(organs, ({ one, many }) => ({
	parent: one(organs, {
		fields: [organs.parentId],
		references: [organs.id],
		relationName: 'organHierarchy'
	}),
	children: many(organs, { relationName: 'organHierarchy' }),
	mandates: many(mandates),
	votes: many(votes, { relationName: 'groupVotes' })
}));

// Relations pour mandates
export const mandatesRelations = relations(mandates, ({ one }) => ({
	actor: one(actors, {
		fields: [mandates.actorId],
		references: [actors.id]
	}),
	organ: one(organs, {
		fields: [mandates.organId],
		references: [organs.id]
	})
}));

// Relations pour scrutins
export const scrutinsRelations = relations(scrutins, ({ one, many }) => ({
	votes: many(votes),
	law: one(laws, {
		fields: [scrutins.lawId],
		references: [laws.id]
	})
}));

// Relations pour votes
export const votesRelations = relations(votes, ({ one }) => ({
	scrutin: one(scrutins, {
		fields: [votes.scrutinId],
		references: [scrutins.id]
	}),
	actor: one(actors, {
		fields: [votes.actorId],
		references: [actors.id],
		relationName: 'actorVotes'
	}),
	group: one(organs, {
		fields: [votes.groupId],
		references: [organs.id],
		relationName: 'groupVotes'
	}),
	delegator: one(actors, {
		fields: [votes.delegatorId],
		references: [actors.id],
		relationName: 'delegation'
	})
}));

// Relations pour laws
export const lawsRelations = relations(laws, ({ many }) => ({
	scrutins: many(scrutins),
	amendments: many(amendments),
	cosignatories: many(lawCosignatories)
}));

// Relations pour lawCosignatories
export const lawCosignatoriesRelations = relations(lawCosignatories, ({ one }) => ({
	law: one(laws, {
		fields: [lawCosignatories.lawId],
		references: [laws.id]
	}),
	actor: one(actors, {
		fields: [lawCosignatories.actorId],
		references: [actors.id]
	})
}));

// Relations pour amendments
export const amendmentsRelations = relations(amendments, ({ one }) => ({
	law: one(laws, {
		fields: [amendments.lawId],
		references: [laws.id]
	}),
	author: one(actors, {
		fields: [amendments.authorId],
		references: [actors.id]
	})
}));
