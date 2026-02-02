import { describe, it, expect, beforeAll } from 'vitest';
import { getActorGroups } from './helpers';

/**
 * Tests d'intégration pour getActorGroups (cohérence temporelle des mandates)
 *
 * Ces tests vérifient que la fonction retourne bien le groupe le plus récent
 * pour chaque acteur, même quand un acteur a plusieurs mandats de groupe.
 *
 * NOTE: Ces tests sont skippés automatiquement si la DB n'est pas disponible (CI)
 */

let dbAvailable = false;
let testActorId: string | null = null;

beforeAll(async () => {
	try {
		const { db, mandates, organs } = await import('$lib/server/db');
		const { eq, sql } = await import('drizzle-orm');

		// Find an actor with multiple group mandates (to test ordering)
		const actorsWithMultipleGroups = await db
			.select({
				actorId: mandates.actorId,
				count: sql<number>`count(distinct ${mandates.organId})`
			})
			.from(mandates)
			.innerJoin(organs, eq(mandates.organId, organs.id))
			.where(eq(organs.type, 'GP'))
			.groupBy(mandates.actorId)
			.having(sql`count(distinct ${mandates.organId}) >= 2`)
			.limit(1);

		if (actorsWithMultipleGroups.length > 0) {
			testActorId = actorsWithMultipleGroups[0].actorId;
		}

		dbAvailable = true;
	} catch {
		dbAvailable = false;
		console.warn('⚠️ Database not available - skipping integration tests');
	}
});

describe('Actor Groups Helpers - Integration', () => {
	describe('getActorGroups', () => {
		it('should return empty map for empty actor list', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const result = await getActorGroups([]);
			expect(result.size).toBe(0);
		});

		it('should return empty map for non-existent actors', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const result = await getActorGroups(['NONEXISTENT_ACTOR_ID']);
			expect(result.size).toBe(0);
		});

		it('should return group data with correct structure', async () => {
			if (!dbAvailable || !testActorId) {
				console.log('Skipping: DB not available or no test data');
				return;
			}

			const result = await getActorGroups([testActorId]);

			if (result.size > 0) {
				const group = result.get(testActorId);
				expect(group).toBeDefined();
				expect(group).toHaveProperty('id');
				expect(group).toHaveProperty('name');
				expect(group).toHaveProperty('shortName');
				expect(group).toHaveProperty('color');
				expect(typeof group!.id).toBe('string');
			}
		});

		it('should return most recent group for actors with multiple mandates', async () => {
			if (!dbAvailable || !testActorId) {
				console.log('Skipping: DB not available or no test data with multiple groups');
				return;
			}

			// Get all group mandates for this actor (raw query to compare)
			const { db, mandates, organs } = await import('$lib/server/db');
			const { eq, sql, desc } = await import('drizzle-orm');

			const allGroupMandates = await db
				.select({
					organId: mandates.organId,
					organName: organs.name,
					startDate: mandates.startDate
				})
				.from(mandates)
				.innerJoin(organs, eq(mandates.organId, organs.id))
				.where(sql`${mandates.actorId} = ${testActorId} AND ${organs.type} = 'GP'`)
				.orderBy(desc(mandates.startDate));

			if (allGroupMandates.length < 2) {
				console.log('Skipping: Actor does not have multiple group mandates');
				return;
			}

			// The most recent group should be the first one (due to DESC order)
			const mostRecentGroup = allGroupMandates[0];

			// Now test our function
			const result = await getActorGroups([testActorId]);
			const group = result.get(testActorId);

			expect(group).toBeDefined();
			expect(group!.id).toBe(mostRecentGroup.organId);
		});

		it('should handle multiple actors efficiently', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const { db, actors } = await import('$lib/server/db');

			// Get a few random actor IDs
			const someActors = await db.select({ id: actors.id }).from(actors).limit(10);

			const actorIds = someActors.map((a) => a.id);
			const result = await getActorGroups(actorIds);

			// All returned groups should have valid structure
			for (const [actorId, group] of result) {
				expect(actorIds).toContain(actorId);
				expect(group.id).toBeTruthy();
			}
		});

		it('should filter by chamber when specified', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const { db, actors, mandates, organs } = await import('$lib/server/db');
			const { eq, and } = await import('drizzle-orm');

			// Get a senator
			const [senator] = await db
				.select({ id: actors.id })
				.from(actors)
				.where(eq(actors.chamber, 'SENAT'))
				.limit(1);

			if (!senator) {
				console.log('Skipping: No senator found in database');
				return;
			}

			const result = await getActorGroups([senator.id], 'SENAT');

			if (result.size > 0) {
				// Verify the returned group is from SENAT chamber
				const group = result.get(senator.id);
				expect(group).toBeDefined();

				// Check that this group is indeed a SENAT group
				const [organData] = await db
					.select({ chamber: organs.chamber })
					.from(organs)
					.where(eq(organs.id, group!.id));

				expect(organData?.chamber).toBe('SENAT');
			}
		});
	});
});
