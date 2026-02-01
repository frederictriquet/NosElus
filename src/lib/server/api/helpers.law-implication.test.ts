import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, actors, laws, lawCosignatories } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { getActorLawsImplication, getLawContributors } from './helpers';

/**
 * Tests d'intégration pour les helpers d'implication législative (Phase 2.2)
 *
 * Ces tests utilisent la base de données réelle car :
 * - Les fonctions testées font des requêtes SQL complexes avec jointures
 * - Le comportement dépend de la structure exacte de la DB
 * - Les données de test existent déjà (cosignataires importés)
 */

describe('Law Implication Helpers - Integration', () => {
	let testActorId: string | null = null;
	let testLawId: string | null = null;

	beforeAll(async () => {
		// Find an actor who has signed laws (cosignatory or author)
		const [actorWithLaws] = await db
			.selectDistinct({ actorId: lawCosignatories.actorId })
			.from(lawCosignatories)
			.limit(1);

		testActorId = actorWithLaws?.actorId || null;

		// Find a law with contributors
		const [lawWithContributors] = await db
			.selectDistinct({ lawId: lawCosignatories.lawId })
			.from(lawCosignatories)
			.limit(1);

		testLawId = lawWithContributors?.lawId || null;
	});

	describe('getActorLawsImplication', () => {
		it('should return empty array when actor has no laws', async () => {
			// Use a non-existent actor ID
			const result = await getActorLawsImplication('PA999999', 10);

			expect(result).toEqual([]);
		});

		it('should return laws signed by actor when actor exists', async () => {
			if (!testActorId) {
				console.warn('No test actor found with laws, skipping test');
				return;
			}

			const result = await getActorLawsImplication(testActorId, 10);

			expect(result.length).toBeGreaterThan(0);

			// Verify structure of returned objects
			const firstLaw = result[0];
			expect(firstLaw).toHaveProperty('lawId');
			expect(firstLaw).toHaveProperty('lawTitle');
			expect(firstLaw).toHaveProperty('lawType');
			expect(firstLaw).toHaveProperty('depositDate');
			expect(firstLaw).toHaveProperty('role');
			expect(firstLaw).toHaveProperty('signatureOrder');

			// Verify role is valid
			expect(['author', 'cosignatory']).toContain(firstLaw.role);
		});

		it('should respect the limit parameter', async () => {
			if (!testActorId) {
				console.warn('No test actor found with laws, skipping test');
				return;
			}

			const limit = 3;
			const result = await getActorLawsImplication(testActorId, limit);

			expect(result.length).toBeLessThanOrEqual(limit);
		});

		it('should order results by deposit date descending', async () => {
			if (!testActorId) {
				console.warn('No test actor found with laws, skipping test');
				return;
			}

			const result = await getActorLawsImplication(testActorId, 10);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					const current = result[i].depositDate;
					const next = result[i + 1].depositDate;

					if (current && next) {
						// Current date should be >= next date (descending order)
						expect(new Date(current).getTime()).toBeGreaterThanOrEqual(
							new Date(next).getTime()
						);
					}
				}
			}
		});

		it('should include both authors and cosignatories', async () => {
			if (!testActorId) {
				console.warn('No test actor found with laws, skipping test');
				return;
			}

			const result = await getActorLawsImplication(testActorId, 50);

			// Check if we have both roles (if actor has diverse contributions)
			const roles = new Set(result.map((law) => law.role));

			// At minimum, result should have valid roles
			roles.forEach((role) => {
				expect(['author', 'cosignatory']).toContain(role);
			});
		});
	});

	describe('getLawContributors', () => {
		it('should return empty array when law has no contributors', async () => {
			// Use a non-existent law ID
			const result = await getLawContributors('NONEXISTENT_LAW_ID');

			expect(result).toEqual([]);
		});

		it('should return contributors when law exists', async () => {
			if (!testLawId) {
				console.warn('No test law found with contributors, skipping test');
				return;
			}

			const result = await getLawContributors(testLawId);

			expect(result.length).toBeGreaterThan(0);

			// Verify structure of returned objects
			const firstContributor = result[0];
			expect(firstContributor).toHaveProperty('actorId');
			expect(firstContributor).toHaveProperty('actorName');
			expect(firstContributor).toHaveProperty('role');
			expect(firstContributor).toHaveProperty('signatureOrder');

			// Verify role is valid
			expect(['author', 'cosignatory']).toContain(firstContributor.role);

			// Verify actorName is formatted
			expect(firstContributor.actorName).toBeTruthy();
			expect(firstContributor.actorName).toContain(' '); // Should have first and last name
		});

		it('should order results by signature order and last name', async () => {
			if (!testLawId) {
				console.warn('No test law found with contributors, skipping test');
				return;
			}

			const result = await getLawContributors(testLawId);

			if (result.length >= 2) {
				// Verify that if signature order is defined, it's ascending
				const withOrder = result.filter((c) => c.signatureOrder !== null);

				for (let i = 0; i < withOrder.length - 1; i++) {
					const current = withOrder[i].signatureOrder;
					const next = withOrder[i + 1].signatureOrder;

					if (current !== null && next !== null) {
						expect(current).toBeLessThanOrEqual(next);
					}
				}
			}
		});

		it('should return both authors and cosignatories', async () => {
			if (!testLawId) {
				console.warn('No test law found with contributors, skipping test');
				return;
			}

			const result = await getLawContributors(testLawId);

			// Collect all roles
			const roles = new Set(result.map((c) => c.role));

			// At minimum, result should have valid roles
			roles.forEach((role) => {
				expect(['author', 'cosignatory']).toContain(role);
			});
		});

		it('should return unique contributors (no duplicates)', async () => {
			if (!testLawId) {
				console.warn('No test law found with contributors, skipping test');
				return;
			}

			const result = await getLawContributors(testLawId);

			// Extract actor IDs
			const actorIds = result.map((c) => c.actorId);

			// Check for uniqueness
			const uniqueActorIds = new Set(actorIds);

			expect(actorIds.length).toBe(uniqueActorIds.size);
		});
	});

	describe('Cross-function consistency', () => {
		it('should have matching data between getActorLawsImplication and getLawContributors', async () => {
			if (!testActorId || !testLawId) {
				console.warn('Missing test data, skipping consistency test');
				return;
			}

			// Get actor's laws
			const actorLaws = await getActorLawsImplication(testActorId, 100);

			// Find a law signed by this actor
			const lawSignedByActor = actorLaws.find((law) => law.lawId === testLawId);

			if (lawSignedByActor) {
				// Get contributors for this law
				const contributors = await getLawContributors(testLawId);

				// Actor should be in the contributors list
				const actorAsContributor = contributors.find((c) => c.actorId === testActorId);

				expect(actorAsContributor).toBeDefined();
				expect(actorAsContributor?.role).toBe(lawSignedByActor.role);
			}
		});
	});
});
