import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins } from '$lib/server/db';
import { eq, and, count, sql, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const deputy1Id = url.searchParams.get('d1');
	const deputy2Id = url.searchParams.get('d2');

	// Get all deputies for selection
	const allDeputies = await db
		.select({
			id: actors.id,
			name: actors.fullName
		})
		.from(actors)
		.orderBy(actors.lastName);

	if (!deputy1Id || !deputy2Id) {
		return {
			deputies: allDeputies,
			comparison: null
		};
	}

	// Get deputy details
	const [deputy1] = await db.select().from(actors).where(eq(actors.id, deputy1Id));
	const [deputy2] = await db.select().from(actors).where(eq(actors.id, deputy2Id));

	if (!deputy1 || !deputy2) {
		return {
			deputies: allDeputies,
			comparison: null,
			error: 'Député non trouvé'
		};
	}

	// Get vote counts for each deputy
	const [votes1Count] = await db
		.select({ value: count() })
		.from(votes)
		.where(eq(votes.actorId, deputy1Id));

	const [votes2Count] = await db
		.select({ value: count() })
		.from(votes)
		.where(eq(votes.actorId, deputy2Id));

	// Get vote distribution for each
	const getDistribution = async (actorId: string) => {
		const result = await db
			.select({
				position: votes.position,
				count: count()
			})
			.from(votes)
			.where(eq(votes.actorId, actorId))
			.groupBy(votes.position);

		const dist = { pour: 0, contre: 0, abstention: 0 };
		for (const r of result) {
			if (r.position in dist) {
				dist[r.position as keyof typeof dist] = r.count;
			}
		}
		return dist;
	};

	const dist1 = await getDistribution(deputy1Id);
	const dist2 = await getDistribution(deputy2Id);

	// Find common scrutins where both voted
	const commonVotes = await db
		.select({
			scrutinId: votes.scrutinId,
			position1: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${deputy1Id} THEN ${votes.position} END)`,
			position2: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${deputy2Id} THEN ${votes.position} END)`
		})
		.from(votes)
		.where(inArray(votes.actorId, [deputy1Id, deputy2Id]))
		.groupBy(votes.scrutinId)
		.having(sql`COUNT(DISTINCT ${votes.actorId}) = 2`);

	// Calculate agreement rate and political distance
	let sameVotes = 0;
	let differentVotes = 0;
	let totalDistance = 0;

	// Distance weights: pour<->contre = 2, pour/contre<->abstention = 1, same = 0
	const getVoteDistance = (v1: string, v2: string): number => {
		if (v1 === v2) return 0;
		if ((v1 === 'pour' && v2 === 'contre') || (v1 === 'contre' && v2 === 'pour')) return 2;
		return 1; // abstention vs pour/contre
	};

	for (const v of commonVotes) {
		if (v.position1 === v.position2) {
			sameVotes++;
		} else {
			differentVotes++;
		}
		totalDistance += getVoteDistance(v.position1, v.position2);
	}

	const agreementRate = commonVotes.length > 0
		? (sameVotes / commonVotes.length) * 100
		: 0;

	// Political distance: normalized 0-100 (0 = identical, 100 = completely opposed)
	// Max possible distance is 2 per vote (pour vs contre on every vote)
	const maxDistance = commonVotes.length * 2;
	const politicalDistance = maxDistance > 0 ? (totalDistance / maxDistance) * 100 : 0;

	// Get sample of disagreements
	const disagreements = await db
		.select({
			scrutinId: scrutins.id,
			scrutinTitle: scrutins.title,
			scrutinDate: scrutins.date,
			position1: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${deputy1Id} THEN ${votes.position} END)`,
			position2: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${deputy2Id} THEN ${votes.position} END)`
		})
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.where(inArray(votes.actorId, [deputy1Id, deputy2Id]))
		.groupBy(scrutins.id, scrutins.title, scrutins.date)
		.having(sql`COUNT(DISTINCT ${votes.actorId}) = 2 AND MAX(CASE WHEN ${votes.actorId} = ${deputy1Id} THEN ${votes.position} END) != MAX(CASE WHEN ${votes.actorId} = ${deputy2Id} THEN ${votes.position} END)`)
		.orderBy(sql`${scrutins.date} DESC`)
		.limit(10);

	return {
		deputies: allDeputies,
		comparison: {
			deputy1: {
				...deputy1,
				voteCount: votes1Count.value,
				distribution: dist1
			},
			deputy2: {
				...deputy2,
				voteCount: votes2Count.value,
				distribution: dist2
			},
			commonVotes: commonVotes.length,
			sameVotes,
			differentVotes,
			agreementRate,
			politicalDistance,
			disagreements
		}
	};
};
