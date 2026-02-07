import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from './+server';
import { db, laws, scrutins, organs } from '$lib/server/db';
import { like } from 'drizzle-orm';

/**
 * Tests d'intégration de l'API group-votes
 *
 * Teste le comportement réel avec la DB pour :
 * - L'AN (legislature '17')
 * - Le PE (legislature 'PE-10' → organs '10')
 */
describe('/api/quiz/group-votes - Integration', () => {
	let anLawIds: string[] = [];
	let peLawIds: string[] = [];

	beforeAll(async () => {
		// Récupérer des vraies lois de test de la DB
		const anLaws = await db
			.select({ id: laws.id })
			.from(laws)
			.where(like(laws.id, 'DLR5L17%'))
			.limit(3);

		const peLaws = await db
			.select({ id: laws.id })
			.from(laws)
			.where(like(laws.id, 'LWPE10%'))
			.limit(3);

		anLawIds = anLaws.map((l) => l.id);
		peLawIds = peLaws.map((l) => l.id);
	});

	describe('Validation des entrées', () => {
		it('should return 400 when lawIds is missing', async () => {
			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ legislature: '17' })
			});

			try {
				await POST({ request } as any);
				expect.fail('Should have thrown error');
			} catch (error: any) {
				expect(error.status).toBe(400);
				expect(error.body.message).toContain('lawIds');
			}
		});

		it('should return 400 when lawIds is empty array', async () => {
			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: [], legislature: '17' })
			});

			try {
				await POST({ request } as any);
				expect.fail('Should have thrown error');
			} catch (error: any) {
				expect(error.status).toBe(400);
			}
		});

		it('should return 400 when lawIds is not an array', async () => {
			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: 'not-an-array', legislature: '17' })
			});

			try {
				await POST({ request } as any);
				expect.fail('Should have thrown error');
			} catch (error: any) {
				expect(error.status).toBe(400);
			}
		});

		it('should return 400 when body is invalid JSON', async () => {
			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json'
			});

			try {
				await POST({ request } as any);
				expect.fail('Should have thrown error');
			} catch (error: any) {
				expect(error.status).toBe(400);
			}
		});
	});

	describe('Assemblée Nationale (legislature 17)', () => {
		it('should return groups and votes for AN laws', async () => {
			if (anLawIds.length === 0) {
				console.warn('No AN laws found, skipping test');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: anLawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			// Structure de réponse
			expect(data).toHaveProperty('groupVotes');
			expect(data).toHaveProperty('groups');

			// Les groupes AN existent
			expect(data.groups.length).toBeGreaterThan(0);

			// Chaque groupe a une structure correcte
			data.groups.forEach((group: any) => {
				expect(group).toHaveProperty('id');
				expect(group).toHaveProperty('name');
				expect(group).toHaveProperty('shortName');
			});

			// groupVotes est un objet indexé par groupId
			expect(typeof data.groupVotes).toBe('object');
		});

		it('should default to legislature 17 when not specified', async () => {
			if (anLawIds.length === 0) {
				console.warn('No AN laws found, skipping test');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: anLawIds })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(data.groups.length).toBeGreaterThan(0);
		});

		it('should calculate majority position correctly (pour > contre)', async () => {
			if (anLawIds.length === 0) {
				console.warn('No AN laws found, skipping test');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: anLawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			// Vérifier qu'au moins un groupe a voté
			const groupVotes = data.groupVotes;
			const hasVotes = Object.values(groupVotes).some(
				(votes: any) => Object.keys(votes).length > 0
			);

			if (!hasVotes) {
				console.warn('No group votes found for these laws');
				return;
			}

			// Vérifier la structure des votes
			Object.values(groupVotes).forEach((votes: any) => {
				Object.values(votes).forEach((vote: any) => {
					expect(vote).toHaveProperty('majorityPosition');
					expect(['pour', 'contre']).toContain(vote.majorityPosition);
					expect(vote).toHaveProperty('pour');
					expect(vote).toHaveProperty('contre');
					expect(typeof vote.pour).toBe('number');
					expect(typeof vote.contre).toBe('number');

					// Vérifier que majorityPosition correspond au max(pour, contre)
					if (vote.pour > vote.contre) {
						expect(vote.majorityPosition).toBe('pour');
					} else {
						expect(vote.majorityPosition).toBe('contre');
					}
				});
			});
		});
	});

	describe('Parlement Européen (legislature PE-10)', () => {
		it('should handle PE legislature format (PE-10 → organs 10)', async () => {
			if (peLawIds.length === 0) {
				console.warn('No PE laws found, skipping test');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: peLawIds, legislature: 'PE-10' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			// Les groupes PE doivent être retournés
			expect(data.groups.length).toBeGreaterThan(0);

			// Vérifier que les groupes sont bien des groupes PE
			// (ils ont legislature '10', pas 'PE-10')
			const peGroups = await db
				.select({ id: organs.id })
				.from(organs)
				.where(like(organs.id, 'GPEU-%'));

			const returnedGroupIds = data.groups.map((g: any) => g.id);
			const peGroupIds = peGroups.map((g) => g.id);

			// Au moins un groupe PE dans les résultats
			const hasPEGroups = returnedGroupIds.some((id: string) => peGroupIds.includes(id));
			expect(hasPEGroups).toBe(true);
		});

		it('should return group votes for PE laws', async () => {
			if (peLawIds.length === 0) {
				console.warn('No PE laws found, skipping test');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: peLawIds, legislature: 'PE-10' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			// Vérifier qu'il y a des votes
			const groupVotes = data.groupVotes;
			expect(Object.keys(groupVotes).length).toBeGreaterThan(0);

			// Au moins un groupe devrait avoir voté sur au moins une loi
			const totalVotes = Object.values(groupVotes).reduce(
				(sum: number, votes: any) => sum + Object.keys(votes).length,
				0
			);

			expect(totalVotes).toBeGreaterThan(0);
		});
	});

	describe('Edge cases', () => {
		it('should return empty groupVotes when lawIds do not exist', async () => {
			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					lawIds: ['FAKE-ID-1', 'FAKE-ID-2'],
					legislature: '17'
				})
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			// Les groupes existent toujours
			expect(data.groups.length).toBeGreaterThan(0);

			// Mais les votes sont vides
			Object.values(data.groupVotes).forEach((votes: any) => {
				expect(Object.keys(votes).length).toBe(0);
			});
		});

		it('should handle mixed valid/invalid lawIds', async () => {
			if (anLawIds.length === 0) {
				console.warn('No AN laws found, skipping test');
				return;
			}

			const mixedLawIds = [...anLawIds.slice(0, 1), 'FAKE-ID'];

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: mixedLawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			// Devrait quand même retourner des données pour les IDs valides
			expect(data.groups.length).toBeGreaterThan(0);
		});

		it('should only return votes where groupResults is not null', async () => {
			// Les scrutins sans groupResults ne doivent pas polluer les résultats
			const allScrutins = await db
				.select({ lawId: scrutins.lawId })
				.from(scrutins)
				.where(like(scrutins.legislature, '17'))
				.limit(5);

			if (allScrutins.length === 0) {
				console.warn('No scrutins found, skipping test');
				return;
			}

			const testLawIds = allScrutins.map((s) => s.lawId).filter((id): id is string => !!id);

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: testLawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			// Tous les votes retournés doivent avoir pour/contre définis
			Object.values(data.groupVotes).forEach((votes: any) => {
				Object.values(votes).forEach((vote: any) => {
					expect(vote.pour).toBeDefined();
					expect(vote.contre).toBeDefined();
				});
			});
		});
	});

	describe('Performance', () => {
		it('should handle large batch of lawIds efficiently', async () => {
			// Récupérer jusqu'à 20 lois
			const largeBatch = await db
				.select({ id: laws.id })
				.from(laws)
				.where(like(laws.id, 'DLR5L17%'))
				.limit(20);

			if (largeBatch.length < 10) {
				console.warn('Not enough laws for performance test');
				return;
			}

			const lawIds = largeBatch.map((l) => l.id);

			const startTime = performance.now();

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			await response.json();

			const duration = performance.now() - startTime;

			// Devrait répondre en moins de 2 secondes pour 20 lois
			expect(duration).toBeLessThan(2000);
		});
	});
});
