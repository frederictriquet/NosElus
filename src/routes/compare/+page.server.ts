import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, mandates, organs } from '$lib/server/db';
import { eq, and, count, sql, inArray, gte, lte, type SQL } from 'drizzle-orm';
import { parsePeriodFilters } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ url }) => {
	const deputy1Id = url.searchParams.get('d1');
	const deputy2Id = url.searchParams.get('d2');
	const periodFilters = parsePeriodFilters(url);

	// Build deputy filter conditions based on legislature
	let deputyIds: string[] | null = null;
	if (periodFilters.legislature) {
		const mandatesInLeg = await db
			.selectDistinct({ actorId: mandates.actorId })
			.from(mandates)
			.where(eq(mandates.legislature, periodFilters.legislature));
		deputyIds = mandatesInLeg.map((m) => m.actorId);
	}

	// Get all deputies for selection (filtered by legislature if specified)
	const allDeputies = deputyIds && deputyIds.length > 0
		? await db
			.select({ id: actors.id, name: actors.fullName })
			.from(actors)
			.where(inArray(actors.id, deputyIds))
			.orderBy(actors.lastName)
		: deputyIds === null
			? await db
				.select({ id: actors.id, name: actors.fullName })
				.from(actors)
				.orderBy(actors.lastName)
			: [];

	const filters = {
		legislature: periodFilters.legislature,
		dateFrom: periodFilters.dateFrom,
		dateTo: periodFilters.dateTo
	};

	// If no deputies selected, return early (no comparison to stream)
	if (!deputy1Id || !deputy2Id) {
		return {
			deputies: allDeputies,
			comparison: null,
			filters
		};
	}

	// Loader for comparison data (streamed)
	const loadComparison = async () => {
		// Get deputy details in parallel
		const [[deputy1], [deputy2]] = await Promise.all([
			db.select().from(actors).where(eq(actors.id, deputy1Id)),
			db.select().from(actors).where(eq(actors.id, deputy2Id))
		]);

		if (!deputy1 || !deputy2) {
			return null;
		}

		// Build scrutin filter conditions for period
		const scrutinConditions: SQL[] = [];
		if (periodFilters.legislature) {
			scrutinConditions.push(eq(scrutins.legislature, periodFilters.legislature));
		}
		if (periodFilters.dateFrom) {
			scrutinConditions.push(gte(scrutins.date, periodFilters.dateFrom));
		}
		if (periodFilters.dateTo) {
			scrutinConditions.push(lte(scrutins.date, periodFilters.dateTo));
		}

		// Get scrutin IDs matching period filter
		let filteredScrutinIds: string[] | null = null;
		if (scrutinConditions.length > 0) {
			const filteredScrutins = await db
				.select({ id: scrutins.id })
				.from(scrutins)
				.where(and(...scrutinConditions));
			filteredScrutinIds = filteredScrutins.map((s) => s.id);
		}

		// Build vote filter conditions
		const buildVoteConditions = (actorId: string): SQL => {
			const conditions: SQL[] = [eq(votes.actorId, actorId)];
			if (filteredScrutinIds !== null && filteredScrutinIds.length > 0) {
				conditions.push(inArray(votes.scrutinId, filteredScrutinIds));
			}
			return conditions.length === 1 ? conditions[0] : and(...conditions)!;
		};

		// Get vote distribution for each
		const getDistribution = async (actorId: string) => {
			if (filteredScrutinIds !== null && filteredScrutinIds.length === 0) {
				return { pour: 0, contre: 0, abstention: 0 };
			}

			const result = await db
				.select({
					position: votes.position,
					count: count()
				})
				.from(votes)
				.where(buildVoteConditions(actorId))
				.groupBy(votes.position);

			const dist = { pour: 0, contre: 0, abstention: 0 };
			for (const r of result) {
				if (r.position in dist) {
					dist[r.position as keyof typeof dist] = r.count;
				}
			}
			return dist;
		};

		// Build common votes filter
		const commonVotesConditions: SQL[] = [inArray(votes.actorId, [deputy1Id, deputy2Id])];
		if (filteredScrutinIds !== null && filteredScrutinIds.length > 0) {
			commonVotesConditions.push(inArray(votes.scrutinId, filteredScrutinIds));
		}

		// Build disagreements filter conditions
		const disagreementsConditions: SQL[] = [inArray(votes.actorId, [deputy1Id, deputy2Id])];
		if (scrutinConditions.length > 0) {
			disagreementsConditions.push(...scrutinConditions);
		}

		// Run all independent queries in parallel
		const [
			groupsData,
			[votes1Count],
			[votes2Count],
			dist1,
			dist2,
			commonVotes,
			disagreements
		] = await Promise.all([
			// Groups for both deputies
			db
				.select({
					actorId: mandates.actorId,
					groupId: organs.id,
					groupShortName: organs.shortName,
					groupColor: organs.color
				})
				.from(mandates)
				.innerJoin(organs, eq(mandates.organId, organs.id))
				.where(sql`${mandates.actorId} IN ${[deputy1Id, deputy2Id]} AND ${organs.type} = 'GP'`),

			// Vote counts
			filteredScrutinIds !== null && filteredScrutinIds.length === 0
				? [{ value: 0 }]
				: db.select({ value: count() }).from(votes).where(buildVoteConditions(deputy1Id)),

			filteredScrutinIds !== null && filteredScrutinIds.length === 0
				? [{ value: 0 }]
				: db.select({ value: count() }).from(votes).where(buildVoteConditions(deputy2Id)),

			// Distributions
			getDistribution(deputy1Id),
			getDistribution(deputy2Id),

			// Common votes
			filteredScrutinIds !== null && filteredScrutinIds.length === 0
				? []
				: db
					.select({
						scrutinId: votes.scrutinId,
						position1: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${deputy1Id} THEN ${votes.position} END)`,
						position2: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${deputy2Id} THEN ${votes.position} END)`
					})
					.from(votes)
					.where(and(...commonVotesConditions))
					.groupBy(votes.scrutinId)
					.having(sql`COUNT(DISTINCT ${votes.actorId}) = 2`),

			// Disagreements
			filteredScrutinIds !== null && filteredScrutinIds.length === 0
				? []
				: db
					.select({
						scrutinId: scrutins.id,
						scrutinTitle: scrutins.title,
						scrutinDate: scrutins.date,
						position1: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${deputy1Id} THEN ${votes.position} END)`,
						position2: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${deputy2Id} THEN ${votes.position} END)`
					})
					.from(votes)
					.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
					.where(and(...disagreementsConditions))
					.groupBy(scrutins.id, scrutins.title, scrutins.date)
					.having(sql`COUNT(DISTINCT ${votes.actorId}) = 2 AND MAX(CASE WHEN ${votes.actorId} = ${deputy1Id} THEN ${votes.position} END) != MAX(CASE WHEN ${votes.actorId} = ${deputy2Id} THEN ${votes.position} END)`)
					.orderBy(sql`${scrutins.date} DESC`)
					.limit(10)
		]);

		// Process groups
		const groupByActor = new Map<string, { id: string; shortName: string | null; color: string | null }>();
		for (const g of groupsData) {
			if (!groupByActor.has(g.actorId) && g.groupId) {
				groupByActor.set(g.actorId, { id: g.groupId, shortName: g.groupShortName, color: g.groupColor });
			}
		}

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
		const maxDistance = commonVotes.length * 2;
		const politicalDistance = maxDistance > 0 ? (totalDistance / maxDistance) * 100 : 0;

		return {
			deputy1: {
				...deputy1,
				group: groupByActor.get(deputy1Id) || null,
				voteCount: votes1Count.value,
				distribution: dist1
			},
			deputy2: {
				...deputy2,
				group: groupByActor.get(deputy2Id) || null,
				voteCount: votes2Count.value,
				distribution: dist2
			},
			commonVotes: commonVotes.length,
			sameVotes,
			differentVotes,
			agreementRate,
			politicalDistance,
			disagreements
		};
	};

	return {
		deputies: allDeputies,
		// Streamed: comparison data loads in background
		comparison: loadComparison(),
		filters
	};
};
