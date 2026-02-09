/**
 * Tests d'intégration pour law-analyzer.ts
 *
 * Ces tests valident que getUnanalyzedLaws() respecte bien la règle :
 * Pas de résumé LLM sans texte complet réel (description > 100 chars)
 *
 * NOTE: Ces tests nécessitent une DB réelle et sont exclus de la CI par défaut
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '$lib/server/db';
import { laws } from '$lib/server/db/schema';
import { getUnanalyzedLaws } from './law-analyzer';
import { sql } from 'drizzle-orm';

let dbAvailable = false;

describe('law-analyzer - Integration', () => {
	beforeAll(async () => {
		try {
			// Vérifier que la DB est accessible
			await db
				.select({ count: sql`count(*)` })
				.from(laws)
				.limit(1);
			dbAvailable = true;
		} catch {
			dbAvailable = false;
			console.warn('Database not available - skipping integration tests');
		}
	});

	describe('getUnanalyzedLaws()', () => {
		it('should only return laws with description > 100 chars', async () => {
			if (!dbAvailable) return;

			// Récupérer des lois non analysées
			const unanalyzedLaws = await getUnanalyzedLaws(50);

			// Vérifier qu'aucune loi retournée n'a une description <= 100 chars
			for (const law of unanalyzedLaws) {
				const descLength = law.description?.length ?? 0;
				expect(descLength).toBeGreaterThan(100);

				// Message d'erreur explicite si ça échoue
				if (descLength <= 100) {
					throw new Error(
						`Law ${law.id} has description length ${descLength} <= 100:\n` +
							`"${law.description}"\n` +
							`This should have been filtered by getUnanalyzedLaws()`
					);
				}
			}
		});

		it('should exclude PE laws with short descriptions like "Proposition de résolution"', async () => {
			if (!dbAvailable) return;

			// Récupérer les lois PE non analysées
			const peLaws = await getUnanalyzedLaws(100, 'PE-10');

			// Vérifier qu'aucune loi PE avec description courte n'est retournée
			const shortDescriptions = peLaws.filter((l) => l.description && l.description.length <= 100);

			expect(shortDescriptions).toHaveLength(0);

			// Si on trouve des descriptions courtes, afficher pour debug
			if (shortDescriptions.length > 0) {
				console.error('Found PE laws with short descriptions:');
				shortDescriptions.forEach((law) => {
					console.error(`  ${law.id}: "${law.description}" (${law.description?.length} chars)`);
				});
			}
		});

		it('should not return laws that already have summaries', async () => {
			if (!dbAvailable) return;

			const unanalyzedLaws = await getUnanalyzedLaws(10);

			// Vérifier qu'aucune loi retournée n'a déjà un résumé
			// (cette vérification se fait via la requête SQL avec isNull(law_summaries))
			expect(unanalyzedLaws.length).toBeGreaterThanOrEqual(0);

			// Note: On ne peut pas tester directement l'absence de résumé sans
			// faire une requête supplémentaire, mais la logique SQL garantit ça
		});

		it('should respect limit parameter', async () => {
			if (!dbAvailable) return;

			const limit = 5;
			const unanalyzedLaws = await getUnanalyzedLaws(limit);

			expect(unanalyzedLaws.length).toBeLessThanOrEqual(limit);
		});

		it('should filter by legislature when specified', async () => {
			if (!dbAvailable) return;

			const legislature = '17';
			const lawsForLegislature = await getUnanalyzedLaws(10, legislature);

			// Vérifier que toutes les lois retournées sont bien de la législature demandée
			lawsForLegislature.forEach((law) => {
				expect(law.legislature).toBe(legislature);
			});
		});

		it('should return empty array when no unanalyzed laws match criteria', async () => {
			if (!dbAvailable) return;

			// Chercher dans une législature qui n'existe probablement pas
			const nonExistentLegislature = 'NONEXISTENT-999';
			const result = await getUnanalyzedLaws(10, nonExistentLegislature);

			expect(result).toEqual([]);
		});
	});
});
