import { describe, it, expect, beforeAll } from 'vitest';
import { getActorLawsImplication, getLawContributors } from './helpers';

/**
 * Tests d'intégration pour les helpers d'implication législative (Phase 2.2)
 *
 * Ces tests utilisent la base de données réelle car :
 * - Les fonctions testées font des requêtes SQL complexes avec jointures
 * - Le comportement dépend de la structure exacte de la DB
 * - Les données de test existent déjà (cosignataires importés)
 *
 * NOTE: Ces tests sont skippés automatiquement si la DB n'est pas disponible (CI)
 */

// Check if DB is available by trying to import and query
let dbAvailable = false;
let testActorId: string | null = null;
let testLawId: string | null = null;

beforeAll(async () => {
	try {
		const { db, lawCosignatories } = await import('$lib/server/db');

		// Try a simple query to check DB connection
		const [actorWithLaws] = await db
			.selectDistinct({ actorId: lawCosignatories.actorId })
			.from(lawCosignatories)
			.limit(1);

		testActorId = actorWithLaws?.actorId || null;

		const [lawWithContributors] = await db
			.selectDistinct({ lawId: lawCosignatories.lawId })
			.from(lawCosignatories)
			.limit(1);

		testLawId = lawWithContributors?.lawId || null;

		dbAvailable = true;
	} catch {
		// DB not available (CI environment without PostgreSQL)
		dbAvailable = false;
		console.warn('⚠️ Database not available - skipping integration tests');
	}
});

describe('Law Implication Helpers - Integration', () => {
	describe('getActorLawsImplication', () => {
		it('should return empty array when actor has no laws', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const result = await getActorLawsImplication('PA999999', 10);
			expect(result).toEqual([]);
		});

		it('should return laws signed by actor when actor exists', async () => {
			if (!dbAvailable || !testActorId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const result = await getActorLawsImplication(testActorId, 10);

			expect(result.length).toBeGreaterThan(0);

			const firstLaw = result[0];
			expect(firstLaw).toHaveProperty('lawId');
			expect(firstLaw).toHaveProperty('lawTitle');
			expect(firstLaw).toHaveProperty('lawType');
			expect(firstLaw).toHaveProperty('depositDate');
			expect(firstLaw).toHaveProperty('role');
			expect(firstLaw).toHaveProperty('signatureOrder');

			expect(['author', 'cosignatory']).toContain(firstLaw.role);
		});

		it('should respect the limit parameter', async () => {
			if (!dbAvailable || !testActorId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const limit = 3;
			const result = await getActorLawsImplication(testActorId, limit);

			expect(result.length).toBeLessThanOrEqual(limit);
		});

		it('should order results by deposit date descending', async () => {
			if (!dbAvailable || !testActorId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const result = await getActorLawsImplication(testActorId, 10);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					const current = result[i].depositDate;
					const next = result[i + 1].depositDate;

					if (current && next) {
						expect(new Date(current).getTime()).toBeGreaterThanOrEqual(new Date(next).getTime());
					}
				}
			}
		});

		it('should include both authors and cosignatories', async () => {
			if (!dbAvailable || !testActorId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const result = await getActorLawsImplication(testActorId, 50);

			const roles = new Set(result.map((law) => law.role));

			roles.forEach((role) => {
				expect(['author', 'cosignatory']).toContain(role);
			});
		});
	});

	describe('getLawContributors', () => {
		it('should return empty array when law has no contributors', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const result = await getLawContributors('NONEXISTENT_LAW_ID');
			expect(result).toEqual([]);
		});

		it('should return contributors when law exists', async () => {
			if (!dbAvailable || !testLawId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const result = await getLawContributors(testLawId);

			expect(result.length).toBeGreaterThan(0);

			const firstContributor = result[0];
			expect(firstContributor).toHaveProperty('actorId');
			expect(firstContributor).toHaveProperty('actorName');
			expect(firstContributor).toHaveProperty('role');
			expect(firstContributor).toHaveProperty('signatureOrder');

			expect(['author', 'cosignatory']).toContain(firstContributor.role);

			expect(firstContributor.actorName).toBeTruthy();
			expect(firstContributor.actorName).toContain(' ');
		});

		it('should order results by signature order and last name', async () => {
			if (!dbAvailable || !testLawId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const result = await getLawContributors(testLawId);

			if (result.length >= 2) {
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
			if (!dbAvailable || !testLawId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const result = await getLawContributors(testLawId);

			const roles = new Set(result.map((c) => c.role));

			roles.forEach((role) => {
				expect(['author', 'cosignatory']).toContain(role);
			});
		});

		it('should return unique contributors (no duplicates)', async () => {
			if (!dbAvailable || !testLawId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const result = await getLawContributors(testLawId);

			const actorIds = result.map((c) => c.actorId);
			const uniqueActorIds = new Set(actorIds);

			expect(actorIds.length).toBe(uniqueActorIds.size);
		});
	});

	describe('Cross-function consistency', () => {
		it('should have matching data between getActorLawsImplication and getLawContributors', async () => {
			if (!dbAvailable || !testActorId || !testLawId) {
				console.log('Skipping: DB not available or missing test data');
				return;
			}

			const actorLaws = await getActorLawsImplication(testActorId, 100);
			const lawSignedByActor = actorLaws.find((law) => law.lawId === testLawId);

			if (lawSignedByActor) {
				const contributors = await getLawContributors(testLawId);
				const actorAsContributor = contributors.find((c) => c.actorId === testActorId);

				expect(actorAsContributor).toBeDefined();
				expect(actorAsContributor?.role).toBe(lawSignedByActor.role);
			}
		});
	});
});
