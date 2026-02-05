import { pgTable, varchar, integer, primaryKey, index } from 'drizzle-orm/pg-core';
import { laws } from './laws';
import { actors } from './actors';

/**
 * Table des cosignataires de dossiers législatifs
 * Lie les acteurs aux dossiers avec leur rôle (auteur, cosignataire, rapporteur)
 */
export const lawCosignatories = pgTable(
	'law_cosignatories',
	{
		lawId: varchar('law_id', { length: 50 })
			.notNull()
			.references(() => laws.id),
		actorId: varchar('actor_id', { length: 20 })
			.notNull()
			.references(() => actors.id),
		role: varchar('role', { length: 30 }).notNull(), // 'author' | 'cosignatory' | 'rapporteur'
		signatureOrder: integer('signature_order') // Ordre de signature (1 = premier auteur)
	},
	(table) => [
		primaryKey({ columns: [table.lawId, table.actorId] }),
		index('law_cosignatories_law_idx').on(table.lawId),
		index('law_cosignatories_actor_idx').on(table.actorId),
		index('law_cosignatories_role_idx').on(table.role)
	]
);

export type LawCosignatory = typeof lawCosignatories.$inferSelect;
export type NewLawCosignatory = typeof lawCosignatories.$inferInsert;
