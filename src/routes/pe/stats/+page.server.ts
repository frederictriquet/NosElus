import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, organs, mandates } from '$lib/server/db';
import { count, eq, sql, desc, inArray, and, like, type SQL } from 'drizzle-orm';
import { mapVoteDistribution } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ locals }) => {
	const terme = locals.periods.pe;

	// Build scrutin filter conditions for PE
	const scrutinConditions: SQL[] = [];
	if (terme && terme !== 'all') {
		scrutinConditions.push(eq(scrutins.legislature, `PE-${terme}`));
	} else {
		scrutinConditions.push(like(scrutins.legislature, 'PE-%'));
	}

	const scrutinWhereClause = scrutinConditions.length > 0 ? and(...scrutinConditions) : undefined;

	// Group filter condition - PE groups only
	const groupCondition = and(eq(organs.type, 'GP'), eq(organs.chamber, 'PE'));

	// ===== Synchronous data =====
	const filters = { terme };

	// ===== Async loaders =====

	// Totals
	const loadTotals = async () => {
		const filteredScrutinsResult = await db
			.select({ id: scrutins.id })
			.from(scrutins)
			.where(scrutinWhereClause);

		const filteredScrutinIds = filteredScrutinsResult.map((s) => s.id);

		const voteWhereClause =
			filteredScrutinIds.length > 0
				? inArray(votes.scrutinId, filteredScrutinIds)
				: sql`1 = 0`;

		const [totalActorsResult, totalVotesResult, totalScrutinsResult] = await Promise.all([
			db.select({ value: count() }).from(actors).where(eq(actors.chamber, 'PE')),
			filteredScrutinIds.length === 0
				? Promise.resolve([{ value: 0 }])
				: db.select({ value: count() }).from(votes).where(voteWhereClause),
			db.select({ value: count() }).from(scrutins).where(scrutinWhereClause)
		]);

		return {
			actors: totalActorsResult[0].value,
			votes: totalVotesResult[0].value,
			scrutins: totalScrutinsResult[0].value
		};
	};

	// Vote distribution
	const loadDistribution = async () => {
		const filteredScrutinsResult = await db
			.select({ id: scrutins.id })
			.from(scrutins)
			.where(scrutinWhereClause);

		const filteredScrutinIds = filteredScrutinsResult.map((s) => s.id);

		if (filteredScrutinIds.length === 0) {
			return { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 };
		}

		const voteDistribution = await db
			.select({ position: votes.position, count: count() })
			.from(votes)
			.where(inArray(votes.scrutinId, filteredScrutinIds))
			.groupBy(votes.position);

		return mapVoteDistribution(voteDistribution);
	};

	// Scrutin results
	const loadScrutinResults = async () => {
		const scrutinsByResult = await db
			.select({ result: scrutins.result, count: count() })
			.from(scrutins)
			.where(scrutinWhereClause)
			.groupBy(scrutins.result);

		const results = { adopté: 0, rejeté: 0 };
		for (const s of scrutinsByResult) {
			if (s.result === 'adopté') results.adopté = s.count;
			if (s.result === 'rejeté') results.rejeté = s.count;
		}
		return results;
	};

	// Monthly activity
	const loadMonthlyActivity = async () => {
		return await db
			.select({
				month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
				count: count()
			})
			.from(scrutins)
			.where(scrutinWhereClause)
			.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
			.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);
	};

	// Top participation (French MEPs)
	const loadTopParticipation = async () => {
		const filteredScrutinsResult = await db
			.select({ id: scrutins.id })
			.from(scrutins)
			.where(scrutinWhereClause);

		const filteredScrutinIds = filteredScrutinsResult.map((s) => s.id);

		if (filteredScrutinIds.length === 0) {
			return [];
		}

		const topParticipationRaw = await db
			.select({
				id: actors.id,
				name: actors.fullName,
				photoUrl: actors.photoUrl,
				voteCount: count(votes.id)
			})
			.from(votes)
			.innerJoin(actors, eq(votes.actorId, actors.id))
			.where(and(inArray(votes.scrutinId, filteredScrutinIds), eq(actors.chamber, 'PE')))
			.groupBy(actors.id, actors.fullName, actors.photoUrl)
			.orderBy(desc(count(votes.id)))
			.limit(10);

		// Get group info for top MEPs
		const topMepIds = topParticipationRaw.map((d) => d.id);
		const topMepGroups =
			topMepIds.length > 0
				? await db
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
							and(inArray(mandates.actorId, topMepIds), eq(organs.type, 'GP'), eq(organs.chamber, 'PE'))
						)
				: [];

		const groupByMep = new Map<
			string,
			{ id: string; name: string | null; shortName: string | null; color: string | null }
		>();
		for (const g of topMepGroups) {
			if (!groupByMep.has(g.actorId) && g.groupId) {
				groupByMep.set(g.actorId, {
					id: g.groupId,
					name: g.groupName,
					shortName: g.groupShortName,
					color: g.groupColor
				});
			}
		}

		return topParticipationRaw.map((d) => ({
			...d,
			group: groupByMep.get(d.id) || null
		}));
	};

	// Group stats
	const loadGroupStats = async () => {
		const filteredScrutinsResult = await db
			.select({ id: scrutins.id })
			.from(scrutins)
			.where(scrutinWhereClause);

		const filteredScrutinIds = filteredScrutinsResult.map((s) => s.id);

		if (filteredScrutinIds.length === 0) {
			return db
				.select({
					groupId: organs.id,
					groupName: organs.name,
					groupShortName: organs.shortName,
					groupColor: organs.color,
					totalVotes: sql<number>`0`,
					pourVotes: sql<number>`0`,
					contreVotes: sql<number>`0`,
					abstentionVotes: sql<number>`0`
				})
				.from(organs)
				.where(groupCondition);
		}

		return await db
			.select({
				groupId: organs.id,
				groupName: organs.name,
				groupShortName: organs.shortName,
				groupColor: organs.color,
				totalVotes: count(votes.id),
				pourVotes: sql<number>`count(case when ${votes.position} = 'pour' then 1 end)`,
				contreVotes: sql<number>`count(case when ${votes.position} = 'contre' then 1 end)`,
				abstentionVotes: sql<number>`count(case when ${votes.position} = 'abstention' then 1 end)`
			})
			.from(organs)
			.leftJoin(votes, and(eq(votes.groupId, organs.id), inArray(votes.scrutinId, filteredScrutinIds)))
			.where(groupCondition)
			.groupBy(organs.id, organs.name, organs.shortName, organs.color)
			.orderBy(desc(count(votes.id)));
	};

	// Heatmap and proximity matrix
	const loadHeatmapAndProximity = async () => {
		const [recentScrutins, groupStats] = await Promise.all([
			db
				.select({
					id: scrutins.id,
					title: scrutins.title,
					date: scrutins.date,
					result: scrutins.result
				})
				.from(scrutins)
				.where(scrutinWhereClause)
				.orderBy(desc(scrutins.date))
				.limit(15),
			loadGroupStats()
		]);

		const activeGroups = groupStats.filter((g) => g.totalVotes > 0);
		const groupIds = activeGroups.map((g) => g.groupId);
		const scrutinIds = recentScrutins.map((s) => s.id);

		const heatmapData =
			scrutinIds.length > 0 && groupIds.length > 0
				? await db
						.select({
							scrutinId: votes.scrutinId,
							groupId: votes.groupId,
							position: votes.position,
							count: count()
						})
						.from(votes)
						.where(inArray(votes.scrutinId, scrutinIds))
						.groupBy(votes.scrutinId, votes.groupId, votes.position)
				: [];

		// Build heatmap matrix
		const heatmapMatrix: Record<string, Record<string, { position: string; count: number }>> = {};
		for (const row of heatmapData) {
			if (!row.groupId) continue;
			if (!heatmapMatrix[row.scrutinId]) {
				heatmapMatrix[row.scrutinId] = {};
			}
			const current = heatmapMatrix[row.scrutinId][row.groupId];
			if (!current || row.count > current.count) {
				heatmapMatrix[row.scrutinId][row.groupId] = {
					position: row.position,
					count: row.count
				};
			}
		}

		// Calculate proximity matrix
		const proximityMatrix: Record<string, Record<string, number>> = {};
		const pairCounts: Record<string, Record<string, { same: number; total: number }>> = {};

		for (const g1 of groupIds) {
			proximityMatrix[g1] = {};
			pairCounts[g1] = {};
			for (const g2 of groupIds) {
				pairCounts[g1][g2] = { same: 0, total: 0 };
			}
		}

		for (const scrutinId of Object.keys(heatmapMatrix)) {
			const scrutinVotes = heatmapMatrix[scrutinId];
			const votingGroups = Object.keys(scrutinVotes);

			for (let i = 0; i < votingGroups.length; i++) {
				for (let j = i + 1; j < votingGroups.length; j++) {
					const g1 = votingGroups[i];
					const g2 = votingGroups[j];
					if (pairCounts[g1]?.[g2]) {
						pairCounts[g1][g2].total++;
						pairCounts[g2][g1].total++;
						if (scrutinVotes[g1].position === scrutinVotes[g2].position) {
							pairCounts[g1][g2].same++;
							pairCounts[g2][g1].same++;
						}
					}
				}
			}
		}

		for (const g1 of groupIds) {
			for (const g2 of groupIds) {
				if (g1 === g2) {
					proximityMatrix[g1][g2] = 100;
				} else if (pairCounts[g1]?.[g2]?.total > 0) {
					proximityMatrix[g1][g2] = Math.round(
						(pairCounts[g1][g2].same / pairCounts[g1][g2].total) * 100
					);
				} else {
					proximityMatrix[g1][g2] = 0;
				}
			}
		}

		const formattedGroups = activeGroups.map((g) => ({
			id: g.groupId,
			name: g.groupShortName || g.groupName,
			color: g.groupColor
		}));

		return {
			heatmap: {
				scrutins: recentScrutins,
				groups: formattedGroups,
				matrix: heatmapMatrix
			},
			proximityMatrix: {
				groups: formattedGroups,
				matrix: proximityMatrix
			}
		};
	};

	// Position evolution
	const loadPositionEvolution = async () => {
		const filteredScrutinsResult = await db
			.select({ id: scrutins.id })
			.from(scrutins)
			.where(scrutinWhereClause);

		const filteredScrutinIds = filteredScrutinsResult.map((s) => s.id);

		if (filteredScrutinIds.length === 0) {
			return [];
		}

		return await db
			.select({
				month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
				pour: sql<number>`count(case when ${votes.position} = 'pour' then 1 end)`,
				contre: sql<number>`count(case when ${votes.position} = 'contre' then 1 end)`,
				abstention: sql<number>`count(case when ${votes.position} = 'abstention' then 1 end)`,
				total: count()
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(and(...scrutinConditions))
			.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
			.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);
	};

	return {
		filters,
		totals: loadTotals(),
		distribution: loadDistribution(),
		scrutinResults: loadScrutinResults(),
		monthlyActivity: loadMonthlyActivity(),
		topParticipation: loadTopParticipation(),
		groupStats: loadGroupStats(),
		heatmapAndProximity: loadHeatmapAndProximity(),
		positionEvolution: loadPositionEvolution()
	};
};
