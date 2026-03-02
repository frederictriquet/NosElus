import { relations } from 'drizzle-orm';
import { actors } from './actors';
import { organs } from './organs';
import { mandates } from './mandates';
import { scrutins } from './scrutins';
import { votes } from './votes';
import { laws } from './laws';
import { amendments } from './amendments';
import { lawCosignatories } from './law-cosignatories';
import { lawSummaries } from './law-summaries';
import { tags } from './tags';
import { lawTags } from './law-tags';
import { lawTextSkipList } from './law-text-skip-list';
import { scrutinTags } from './scrutin-tags';

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
	}),
	scrutinTags: many(scrutinTags)
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
export const lawsRelations = relations(laws, ({ one, many }) => ({
	scrutins: many(scrutins),
	amendments: many(amendments),
	cosignatories: many(lawCosignatories),
	summary: one(lawSummaries, {
		fields: [laws.id],
		references: [lawSummaries.lawId]
	}),
	lawTags: many(lawTags),
	textSkip: one(lawTextSkipList, {
		fields: [laws.id],
		references: [lawTextSkipList.lawId]
	})
}));

// Relations pour lawSummaries
export const lawSummariesRelations = relations(lawSummaries, ({ one }) => ({
	law: one(laws, {
		fields: [lawSummaries.lawId],
		references: [laws.id]
	})
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

// Relations pour tags
export const tagsRelations = relations(tags, ({ many }) => ({
	lawTags: many(lawTags),
	scrutinTags: many(scrutinTags)
}));

// Relations pour lawTags
export const lawTagsRelations = relations(lawTags, ({ one }) => ({
	law: one(laws, {
		fields: [lawTags.lawId],
		references: [laws.id]
	}),
	tag: one(tags, {
		fields: [lawTags.tagSlug],
		references: [tags.slug]
	})
}));

// Relations pour scrutinTags
export const scrutinTagsRelations = relations(scrutinTags, ({ one }) => ({
	scrutin: one(scrutins, {
		fields: [scrutinTags.scrutinId],
		references: [scrutins.id]
	}),
	tag: one(tags, {
		fields: [scrutinTags.tagSlug],
		references: [tags.slug]
	})
}));

// Relations pour lawTextSkipList
export const lawTextSkipListRelations = relations(lawTextSkipList, ({ one }) => ({
	law: one(laws, {
		fields: [lawTextSkipList.lawId],
		references: [laws.id]
	})
}));
