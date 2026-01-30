import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, mandates, organs } from '$lib/server/db';
import { eq, and, count, sql, inArray, like, type SQL } from 'drizzle-orm';
import { getTermDates } from '$lib/server/periods/pe-terms';

export const load: PageServerLoad = async ({ url, locals }) => {
	const mep1Id = url.searchParams.get('m1');
	const mep2Id = url.searchParams.get('m2');
	const terme = locals.periods.pe;

	// Get term dates if specified
	const termDates = terme && terme !== 'all' ? await getTermDates(terme) : null;

	// Get French MEPs for selection, filtered by term if specified
	let allMeps;
	if (termDates && terme && terme !== 'all') {
		const { start, end } = termDates;
		// Get MEPs who had an active mandate during this term
		const activeMandates = await db
			.selectDistinct({ actorId: mandates.actorId })
			.from(mandates)
			.innerJoin(actors, eq(mandates.actorId, actors.id))
			.where(
				and(
					eq(actors.chamber, 'PE'),
					like(mandates.organId, 'GPEU-%'),
					eq(mandates.legislature, terme),
					end ? sql`${mandates.startDate} <= ${end}` : sql`1=1`,
					sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`
				)
			);
		const mepIds = activeMandates.map((m) => m.actorId);

		allMeps = mepIds.length > 0
			? await db
				.select({ id: actors.id, name: actors.fullName })
				.from(actors)
				.where(and(eq(actors.chamber, 'PE'), inArray(actors.id, mepIds)))
				.orderBy(actors.lastName)
			: [];
	} else {
		allMeps = await db
			.select({ id: actors.id, name: actors.fullName })
			.from(actors)
			.where(eq(actors.chamber, 'PE'))
			.orderBy(actors.lastName);
	}

	// If no MEPs selected, return early
	if (!mep1Id || !mep2Id) {
		return {
			meps: allMeps,
			comparison: null,
			filters: { terme }
		};
	}

	// Loader for comparison data (streamed)
	const loadComparison = async () => {
		// Get MEP details in parallel
		const [[mep1], [mep2]] = await Promise.all([
			db
				.select()
				.from(actors)
				.where(and(eq(actors.id, mep1Id), eq(actors.chamber, 'PE'))),
			db
				.select()
				.from(actors)
				.where(and(eq(actors.id, mep2Id), eq(actors.chamber, 'PE')))
		]);

		if (!mep1 || !mep2) {
			return null;
		}

		// Get PE scrutins, filtered by term if specified
		const peScrutins = terme && terme !== 'all'
			? await db
				.select({ id: scrutins.id })
				.from(scrutins)
				.where(eq(scrutins.legislature, `PE-${terme}`))
			: await db
				.select({ id: scrutins.id })
				.from(scrutins)
				.where(like(scrutins.legislature, 'PE-%'));

		const peScrutinIds = peScrutins.map((s) => s.id);

		if (peScrutinIds.length === 0) {
			// No PE votes yet
			return {
				mep1: { ...mep1, group: null, voteCount: 0, distribution: { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 } },
				mep2: { ...mep2, group: null, voteCount: 0, distribution: { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 } },
				commonVotes: 0,
				sameVotes: 0,
				differentVotes: 0,
				agreementRate: 0,
				politicalDistance: 0,
				disagreements: []
			};
		}

		// Build vote filter conditions for PE votes
		const buildVoteConditions = (actorId: string): SQL => {
			return and(eq(votes.actorId, actorId), inArray(votes.scrutinId, peScrutinIds))!;
		};

		// Get vote distribution for each
		const getDistribution = async (actorId: string) => {
			const result = await db
				.select({
					position: votes.position,
					count: count()
				})
				.from(votes)
				.where(buildVoteConditions(actorId))
				.groupBy(votes.position);

			const dist = { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 };
			for (const r of result) {
				if (r.position in dist) {
					dist[r.position as keyof typeof dist] = r.count;
				}
			}
			return dist;
		};

		// Run all independent queries in parallel
		const [groupsData, [votes1Count], [votes2Count], dist1, dist2, commonVotes, disagreements] =
			await Promise.all([
				// Groups for both MEPs
				db
					.select({
						actorId: mandates.actorId,
						groupId: organs.id,
						groupName: organs.name,
						groupShortName: organs.shortName,
						groupColor: organs.color
					})
					.from(mandates)
					.innerJoin(organs, eq(mandates.organId, organs.id))
					.where(
						sql`${mandates.actorId} IN ${[mep1Id, mep2Id]} AND ${organs.type} = 'GP' AND ${organs.chamber} = 'PE'`
					),

				// Vote counts
				db.select({ value: count() }).from(votes).where(buildVoteConditions(mep1Id)),
				db.select({ value: count() }).from(votes).where(buildVoteConditions(mep2Id)),

				// Distributions
				getDistribution(mep1Id),
				getDistribution(mep2Id),

				// Common votes
				db
					.select({
						scrutinId: votes.scrutinId,
						position1: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${mep1Id} THEN ${votes.position} END)`,
						position2: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${mep2Id} THEN ${votes.position} END)`
					})
					.from(votes)
					.where(and(inArray(votes.actorId, [mep1Id, mep2Id]), inArray(votes.scrutinId, peScrutinIds)))
					.groupBy(votes.scrutinId)
					.having(sql`COUNT(DISTINCT ${votes.actorId}) = 2`),

				// Disagreements
				db
					.select({
						scrutinId: scrutins.id,
						scrutinTitle: scrutins.title,
						scrutinDate: scrutins.date,
						position1: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${mep1Id} THEN ${votes.position} END)`,
						position2: sql<string>`MAX(CASE WHEN ${votes.actorId} = ${mep2Id} THEN ${votes.position} END)`
					})
					.from(votes)
					.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
					.where(
						and(inArray(votes.actorId, [mep1Id, mep2Id]), like(scrutins.legislature, 'PE-%'))
					)
					.groupBy(scrutins.id, scrutins.title, scrutins.date)
					.having(
						sql`COUNT(DISTINCT ${votes.actorId}) = 2 AND MAX(CASE WHEN ${votes.actorId} = ${mep1Id} THEN ${votes.position} END) != MAX(CASE WHEN ${votes.actorId} = ${mep2Id} THEN ${votes.position} END)`
					)
					.orderBy(sql`${scrutins.date} DESC`)
					.limit(10)
			]);

		// Process groups
		const groupByActor = new Map<
			string,
			{ id: string; name: string | null; shortName: string | null; color: string | null }
		>();
		for (const g of groupsData) {
			if (!groupByActor.has(g.actorId) && g.groupId) {
				groupByActor.set(g.actorId, {
					id: g.groupId,
					name: g.groupName,
					shortName: g.groupShortName,
					color: g.groupColor
				});
			}
		}

		// Calculate agreement rate and political distance
		let sameVotes = 0;
		let differentVotes = 0;
		let totalDistance = 0;

		const getVoteDistance = (v1: string, v2: string): number => {
			if (v1 === v2) return 0;
			if ((v1 === 'pour' && v2 === 'contre') || (v1 === 'contre' && v2 === 'pour')) return 2;
			return 1;
		};

		for (const v of commonVotes) {
			if (v.position1 === v.position2) {
				sameVotes++;
			} else {
				differentVotes++;
			}
			totalDistance += getVoteDistance(v.position1, v.position2);
		}

		const agreementRate = commonVotes.length > 0 ? (sameVotes / commonVotes.length) * 100 : 0;

		const maxDistance = commonVotes.length * 2;
		const politicalDistance = maxDistance > 0 ? (totalDistance / maxDistance) * 100 : 0;

		return {
			mep1: {
				...mep1,
				group: groupByActor.get(mep1Id) || null,
				voteCount: votes1Count.value,
				distribution: dist1
			},
			mep2: {
				...mep2,
				group: groupByActor.get(mep2Id) || null,
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
		meps: allMeps,
		comparison: loadComparison(),
		filters: { terme }
	};
};
