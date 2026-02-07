import { describe, it, expect, beforeAll } from 'vitest';
import { like } from 'drizzle-orm';

/**
 * Tests d'intégration de l'API group-votes
 *
 * Teste le comportement réel avec la DB pour :
 * - L'AN (legislature '17')
 * - Le PE (legislature 'PE-10' → organs '10')
 *
 * NOTE: Ces tests sont skippés automatiquement si la DB n'est pas disponible (CI)
 */

let dbAvailable = false;
let db: any;
let laws: any;
let scrutins: any;
let organs: any;
let POST: any;

describe('/api/quiz/group-votes - Integration', () => {
	let anLawIds: string[] = [];
	let peLawIds: string[] = [];

	beforeAll(async () => {
		try {
			const dbModule = await import('$lib/server/db');
			db = dbModule.db;
			laws = dbModule.laws;
			scrutins = dbModule.scrutins;
			organs = dbModule.organs;

			const serverModule = await import('./+server');
			POST = serverModule.POST;

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

			anLawIds = anLaws.map((l: any) => l.id);
			peLawIds = peLaws.map((l: any) => l.id);
			dbAvailable = true;
		} catch {
			dbAvailable = false;
			console.warn('⚠️ Database not available - skipping integration tests');
		}
	});

	describe('Validation des entrées', () => {
		it('should return 400 when lawIds is missing', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

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
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

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
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

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
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

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
			if (!dbAvailable || anLawIds.length === 0) {
				console.log('Skipping: DB not available or no AN laws');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: anLawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(data).toHaveProperty('groupVotes');
			expect(data).toHaveProperty('groups');
			expect(data.groups.length).toBeGreaterThan(0);

			data.groups.forEach((group: any) => {
				expect(group).toHaveProperty('id');
				expect(group).toHaveProperty('name');
				expect(group).toHaveProperty('shortName');
			});

			expect(typeof data.groupVotes).toBe('object');
		});

		it('should default to legislature 17 when not specified', async () => {
			if (!dbAvailable || anLawIds.length === 0) {
				console.log('Skipping: DB not available or no AN laws');
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
			if (!dbAvailable || anLawIds.length === 0) {
				console.log('Skipping: DB not available or no AN laws');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: anLawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			const groupVotes = data.groupVotes;
			const hasVotes = Object.values(groupVotes).some(
				(votes: any) => Object.keys(votes).length > 0
			);

			if (!hasVotes) {
				console.warn('No group votes found for these laws');
				return;
			}

			Object.values(groupVotes).forEach((votes: any) => {
				Object.values(votes).forEach((vote: any) => {
					expect(vote).toHaveProperty('majorityPosition');
					expect(['pour', 'contre']).toContain(vote.majorityPosition);
					expect(vote).toHaveProperty('pour');
					expect(vote).toHaveProperty('contre');
					expect(typeof vote.pour).toBe('number');
					expect(typeof vote.contre).toBe('number');

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
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: peLawIds, legislature: 'PE-10' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(data.groups.length).toBeGreaterThan(0);

			const peGroups = await db
				.select({ id: organs.id })
				.from(organs)
				.where(like(organs.id, 'GPEU-%'));

			const returnedGroupIds = data.groups.map((g: any) => g.id);
			const peGroupIds = peGroups.map((g: any) => g.id);

			const hasPEGroups = returnedGroupIds.some((id: string) => peGroupIds.includes(id));
			expect(hasPEGroups).toBe(true);
		});

		it('should return group votes for PE laws', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: peLawIds, legislature: 'PE-10' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			const groupVotes = data.groupVotes;
			expect(Object.keys(groupVotes).length).toBeGreaterThan(0);

			const totalVotes = Object.values(groupVotes).reduce(
				(sum: number, votes: any) => sum + Object.keys(votes).length,
				0
			);

			expect(totalVotes).toBeGreaterThan(0);
		});
	});

	describe('Edge cases', () => {
		it('should return empty groupVotes when lawIds do not exist', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

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

			expect(data.groups.length).toBeGreaterThan(0);

			Object.values(data.groupVotes).forEach((votes: any) => {
				expect(Object.keys(votes).length).toBe(0);
			});
		});

		it('should handle mixed valid/invalid lawIds', async () => {
			if (!dbAvailable || anLawIds.length === 0) {
				console.log('Skipping: DB not available or no AN laws');
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

			expect(data.groups.length).toBeGreaterThan(0);
		});

		it('should only return votes where groupResults is not null', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const allScrutins = await db
				.select({ lawId: scrutins.lawId })
				.from(scrutins)
				.where(like(scrutins.legislature, '17'))
				.limit(5);

			if (allScrutins.length === 0) {
				console.warn('No scrutins found, skipping test');
				return;
			}

			const testLawIds = allScrutins
				.map((s: any) => s.lawId)
				.filter((id: any): id is string => !!id);

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds: testLawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			const data = await response.json();

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
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const largeBatch = await db
				.select({ id: laws.id })
				.from(laws)
				.where(like(laws.id, 'DLR5L17%'))
				.limit(20);

			if (largeBatch.length < 10) {
				console.warn('Not enough laws for performance test');
				return;
			}

			const lawIds = largeBatch.map((l: any) => l.id);

			const startTime = performance.now();

			const request = new Request('http://localhost/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds, legislature: '17' })
			});

			const response = await POST({ request } as any);
			await response.json();

			const duration = performance.now() - startTime;

			expect(duration).toBeLessThan(2000);
		});
	});
});
