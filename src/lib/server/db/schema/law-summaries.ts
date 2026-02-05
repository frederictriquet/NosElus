import { pgTable, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { laws } from './laws';

/**
 * Table pour stocker les résumés générés par LLM pour les lois.
 * Les tags ont été déplacés vers la table law_tags (relation many-to-many).
 *
 * Séparée de la table laws pour :
 * - Garder les données originales intactes
 * - Permettre de regénérer les analyses sans perdre les données
 * - Stocker les métadonnées sur l'analyse (modèle, date, etc.)
 */
export const lawSummaries = pgTable('law_summaries', {
	lawId: varchar('law_id', { length: 50 })
		.primaryKey()
		.references(() => laws.id),
	// Résumé en une phrase accessible au grand public
	summary: text('summary').notNull(),
	// Métadonnées de l'analyse
	model: varchar('model', { length: 100 }).notNull(), // ex: "mistral", "llama3.1"
	modelVersion: varchar('model_version', { length: 50 }), // Version si disponible
	// Contrôle qualité
	isReviewed: boolean('is_reviewed').default(false), // Validé manuellement ?
	reviewedAt: timestamp('reviewed_at'),
	// Timestamps
	analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type LawSummary = typeof lawSummaries.$inferSelect;
export type NewLawSummary = typeof lawSummaries.$inferInsert;
