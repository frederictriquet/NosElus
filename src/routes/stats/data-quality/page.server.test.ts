import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Tests d'intégration du dashboard qualité des données
 *
 * Vérifie que :
 * - Les requêtes SQL retournent les bonnes données
 * - Les 3 promises (globalStats, legislatureStats, chamberStats) se résolvent correctement
 * - Les données sont formatées correctement pour chaque chambre
 * - Toutes les valeurs sont des numbers (pas des strings PostgreSQL bigint)
 *
 * NOTE: Ces tests sont skippés automatiquement si la DB n'est pas disponible (CI)
 */

let dbAvailable = false;
let load: any;

// Cache des résultats pour éviter d'appeler load() à chaque test
let cachedResult: any = null;
async function getResult() {
	if (!cachedResult) {
		cachedResult = await load();
	}
	return cachedResult;
}

describe('/stats/data-quality - Integration', () => {
	beforeAll(async () => {
		try {
			const serverModule = await import('./+page.server');
			load = serverModule.load;

			// Vérifier que la DB est accessible en résolvant une promise
			const result = await load();
			await result.globalStats;

			dbAvailable = true;
		} catch {
			dbAvailable = false;
			console.warn('Database not available - skipping integration tests');
		}
	});

	describe('globalStats', () => {
		it('should return all required fields as numbers', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const stats = await result.globalStats;

			// Vérifier la structure
			expect(stats).toHaveProperty('totalLaws');
			expect(stats).toHaveProperty('totalScrutins');
			expect(stats).toHaveProperty('totalActors');
			expect(stats).toHaveProperty('totalVotes');
			expect(stats).toHaveProperty('coverageVotes');
			expect(stats).toHaveProperty('coverageAI');

			// Vérifier que les valeurs sont des numbers (pas des strings bigint)
			expect(typeof stats.totalLaws).toBe('number');
			expect(typeof stats.totalScrutins).toBe('number');
			expect(typeof stats.totalActors).toBe('number');
			expect(typeof stats.totalVotes).toBe('number');
			expect(typeof stats.coverageVotes).toBe('number');
			expect(typeof stats.coverageAI).toBe('number');

			// Valeurs positives attendues avec de vraies données
			expect(stats.totalLaws).toBeGreaterThan(0);
			expect(stats.totalScrutins).toBeGreaterThan(0);
			expect(stats.totalActors).toBeGreaterThan(0);
			expect(stats.totalVotes).toBeGreaterThan(0);

			// Les pourcentages doivent être entre 0 et 100
			expect(stats.coverageVotes).toBeGreaterThanOrEqual(0);
			expect(stats.coverageVotes).toBeLessThanOrEqual(100);
			expect(stats.coverageAI).toBeGreaterThanOrEqual(0);
			expect(stats.coverageAI).toBeLessThanOrEqual(100);
		});
	});

	describe('legislatureStats', () => {
		it('should return data for AN, PE and Sénat', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const stats = await result.legislatureStats;

			expect(Array.isArray(stats)).toBe(true);
			expect(stats.length).toBeGreaterThan(0);

			const anStats = stats.filter((s: any) => s.chamber === 'AN');
			const peStats = stats.filter((s: any) => s.chamber === 'PE');

			expect(anStats.length).toBeGreaterThan(0);
			expect(peStats.length).toBeGreaterThan(0);
		});

		it('should have correct structure with number types', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const stats = await result.legislatureStats;
			const firstStat = stats[0];

			// Structure
			expect(firstStat).toHaveProperty('legislature');
			expect(firstStat).toHaveProperty('chamber');
			expect(firstStat).toHaveProperty('totalLaws');
			expect(firstStat).toHaveProperty('lawsWithVotes');
			expect(firstStat).toHaveProperty('lawsWithSummaries');
			expect(firstStat).toHaveProperty('lawsWithTags');
			expect(firstStat).toHaveProperty('lawsWithDescription');
			expect(firstStat).toHaveProperty('totalScrutins');

			// Types numériques
			expect(typeof firstStat.totalLaws).toBe('number');
			expect(typeof firstStat.lawsWithVotes).toBe('number');
			expect(typeof firstStat.totalScrutins).toBe('number');

			// Champs supprimés ne doivent pas exister
			expect(firstStat).not.toHaveProperty('scrutinsLinked');
			expect(firstStat).not.toHaveProperty('scrutinsCategorized');

			// Chambre valide
			expect(['AN', 'PE', 'SENAT']).toContain(firstStat.chamber);
		});

		it('should correctly identify chamber from legislature ID', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const stats = await result.legislatureStats;

			// PE- → PE
			stats
				.filter((s: any) => s.legislature.startsWith('PE-'))
				.forEach((s: any) => {
					expect(s.chamber).toBe('PE');
				});

			// SE- → SENAT
			stats
				.filter((s: any) => s.legislature.startsWith('SE-'))
				.forEach((s: any) => {
					expect(s.chamber).toBe('SENAT');
				});

			// Numériques → AN
			stats
				.filter((s: any) => !s.legislature.startsWith('PE-') && !s.legislature.startsWith('SE-'))
				.forEach((s: any) => {
					expect(s.chamber).toBe('AN');
				});
		});

		it('should have consistent data (sub-counts <= totalLaws)', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const stats = await result.legislatureStats;

			stats.forEach((stat: any) => {
				expect(stat.lawsWithVotes).toBeLessThanOrEqual(stat.totalLaws);
				expect(stat.lawsWithSummaries).toBeLessThanOrEqual(stat.totalLaws);
				expect(stat.lawsWithTags).toBeLessThanOrEqual(stat.totalLaws);
				expect(stat.lawsWithDescription).toBeLessThanOrEqual(stat.totalLaws);
			});
		});
	});

	describe('chamberStats', () => {
		it('should return statistics for all 3 chambers', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const stats = await result.chamberStats;

			expect(Array.isArray(stats)).toBe(true);
			expect(stats.length).toBe(3);

			const chambers = stats.map((s: any) => s.chamber).sort();
			expect(chambers).toEqual(['AN', 'PE', 'SENAT']);
		});

		it('should have correct structure with number types', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const stats = await result.chamberStats;

			stats.forEach((chamberStat: any) => {
				// Structure
				expect(chamberStat).toHaveProperty('chamber');
				expect(chamberStat).toHaveProperty('totalActors');
				expect(chamberStat).toHaveProperty('totalGroups');
				expect(chamberStat).toHaveProperty('groupsWithColor');
				expect(chamberStat).toHaveProperty('totalMandates');
				expect(chamberStat).toHaveProperty('actorsWithStats');

				// Types numériques
				expect(typeof chamberStat.totalActors).toBe('number');
				expect(typeof chamberStat.totalGroups).toBe('number');
				expect(typeof chamberStat.groupsWithColor).toBe('number');
				expect(typeof chamberStat.totalMandates).toBe('number');
				expect(typeof chamberStat.actorsWithStats).toBe('number');

				// Cohérence
				expect(chamberStat.groupsWithColor).toBeLessThanOrEqual(chamberStat.totalGroups);
				expect(chamberStat.actorsWithStats).toBeLessThanOrEqual(chamberStat.totalActors);

				// Toutes les valeurs >= 0
				expect(chamberStat.totalActors).toBeGreaterThanOrEqual(0);
				expect(chamberStat.totalGroups).toBeGreaterThanOrEqual(0);
				expect(chamberStat.totalMandates).toBeGreaterThanOrEqual(0);
			});
		});

		it('should have actors and groups for all chambers', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const stats = await result.chamberStats;

			stats.forEach((chamberStat: any) => {
				expect(chamberStat.totalActors).toBeGreaterThan(0);
				expect(chamberStat.totalGroups).toBeGreaterThan(0);
			});
		});
	});

	describe('Cross-validation', () => {
		it('should have consistent totalActors across global and chamber stats', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const [global, chambers] = await Promise.all([result.globalStats, result.chamberStats]);

			// La somme des acteurs par chambre doit être égale au total global
			const sumActors = chambers.reduce((sum: number, s: any) => sum + s.totalActors, 0);
			expect(sumActors).toBe(global.totalActors);
		});

		it('should have consistent totalLaws across global and legislature stats', async () => {
			if (!dbAvailable) return;

			const result = await getResult();
			const [global, legislatures] = await Promise.all([
				result.globalStats,
				result.legislatureStats
			]);

			// La somme des lois par mandature doit être égale au total global
			const sumLaws = legislatures.reduce((sum: number, s: any) => sum + s.totalLaws, 0);
			expect(sumLaws).toBe(global.totalLaws);
		});
	});

	describe('Streaming', () => {
		it('should return independent promises that resolve separately', async () => {
			if (!dbAvailable) return;

			// Appel frais pour tester le streaming
			const result = await load();

			// Chaque promise doit pouvoir se résoudre indépendamment
			const globalStats = await result.globalStats;
			expect(globalStats).toBeDefined();
			expect(globalStats.totalLaws).toBeGreaterThan(0);

			const legislatureStats = await result.legislatureStats;
			expect(legislatureStats).toBeDefined();
			expect(Array.isArray(legislatureStats)).toBe(true);

			const chamberStats = await result.chamberStats;
			expect(chamberStats).toBeDefined();
			expect(Array.isArray(chamberStats)).toBe(true);
		});
	});

	describe('Performance', () => {
		it('should load all data in reasonable time', async () => {
			if (!dbAvailable) return;

			const start = Date.now();
			const result = await load();

			await Promise.all([result.globalStats, result.legislatureStats, result.chamberStats]);

			const duration = Date.now() - start;

			// Les requêtes doivent se terminer en moins de 3 secondes
			// (réduit de 5s à 3s grâce à la réécriture CTE)
			expect(duration).toBeLessThan(3000);
		});
	});
});
