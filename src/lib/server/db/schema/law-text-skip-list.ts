import { pgTable, varchar, real, text, timestamp } from 'drizzle-orm/pg-core';
import { laws } from './laws';

export const lawTextSkipList = pgTable('law_text_skip_list', {
	lawId: varchar('law_id', { length: 50 })
		.primaryKey()
		.references(() => laws.id),
	reason: varchar('reason', { length: 30 }).notNull(), // 'low_score' | 'not_found' | 'text_too_short'
	bestScore: real('best_score'), // meilleur score Jaccard obtenu
	bestMatchTitle: text('best_match_title'), // titre du meilleur candidat Légifrance
	bestMatchTextId: varchar('best_match_text_id', { length: 100 }), // textId Légifrance du meilleur candidat
	attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
	threshold: real('threshold') // seuil utilisé lors de la tentative
});

export type LawTextSkip = typeof lawTextSkipList.$inferSelect;
export type NewLawTextSkip = typeof lawTextSkipList.$inferInsert;
