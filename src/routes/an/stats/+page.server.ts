import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, organs, mandates } from '$lib/server/db';
import { count, eq, sql, desc, inArray, and, gte, lte, notLike, isNull, or, type SQL } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, locals }) => {
	const legislature = locals.periods.an;
	const dateFrom = url.searchParams.get('dateFrom') || null;
	const dateTo = url.searchParams.get('dateTo') || null;

	// Build scrutin filter conditions
	const scrutinConditions: SQL[] = [];
	if (legislature && legislature !== 'all') {
		scrutinConditions.push(eq(scrutins.legislature, legislature));
	}
	if (dateFrom) {
		scrutinConditions.push(gte(scrutins.date, dateFrom));
	}
	if (dateTo) {
		scrutinConditions.push(lte(scrutins.date, dateTo));
	}

	const scrutinWhereClause = scrutinConditions.length > 0 ? and(...scrutinConditions) : undefined;

	// Group filter condition
	const today = new Date().toISOString().split('T')[0];
	const groupCondition = and(
		eq(organs.type, 'GP'),
		notLike(organs.id, 'PO_GP_%'),
		or(isNull(organs.endDate), gte(organs.endDate, today))
	);

	// ===== Synchronous data (needed immediately for page structure) =====
	const filters = {
		legislature,
		dateFrom,
		dateTo
	};

	// ===== Async loaders - each returns a promise that will be streamed =====

	// Totals: actors, votes, scrutins count
	const loadTotals = async () => {
		const [filteredScrutinsResult, actorIdsResult] = await Promise.all([
			scrutinConditions.length > 0
				? db.select({ id: scrutins.id }).from(scrutins).where(scrutinWhereClause)
				: Promise.resolve(null),
			legislature
				? db.selectDistinct({ actorId: mandates.actorId }).from(mandates)
					.where(eq(mandates.legislature, legislature))
				: Promise.resolve(null)
		]);

		const filteredScrutinIds = filteredScrutinsResult?.map((s) => s.id) ?? null;
		const actorIdsInLegislature = actorIdsResult?.map((m) => m.actorId) ?? null;

		const voteWhereClause = filteredScrutinIds !== null && filteredScrutinIds.length > 0
			? inArray(votes.scrutinId, filteredScrutinIds)
			: filteredScrutinIds !== null
				? sql`1 = 0`
				: undefined;

		const [totalActorsResult, totalVotesResult, totalScrutinsResult] = await Promise.all([
			actorIdsInLegislature !== null
				? actorIdsInLegislature.length > 0
					? db.select({ value: count() }).from(actors).where(inArray(actors.id, actorIdsInLegislature))
					: Promise.resolve([{ value: 0 }])
				: db.select({ value: count() }).from(actors),
			filteredScrutinIds !== null && filteredScrutinIds.length === 0
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
		const filteredScrutinsResult = scrutinConditions.length > 0
			? await db.select({ id: scrutins.id }).from(scrutins).where(scrutinWhereClause)
			: null;

		const filteredScrutinIds = filteredScrutinsResult?.map((s) => s.id) ?? null;

		const voteWhereClause = filteredScrutinIds !== null && filteredScrutinIds.length > 0
			? inArray(votes.scrutinId, filteredScrutinIds)
			: filteredScrutinIds !== null
				? sql`1 = 0`
				: undefined;

		const voteDistribution = filteredScrutinIds !== null && filteredScrutinIds.length === 0
			? []
			: await db.select({ position: votes.position, count: count() })
				.from(votes).where(voteWhereClause).groupBy(votes.position);

		const distribution = { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 };
		for (const v of voteDistribution) {
			if (v.position in distribution) {
				distribution[v.position as keyof typeof distribution] = v.count;
			}
		}
		return distribution;
	};

	// Scrutin results
	const loadScrutinResults = async () => {
		const scrutinsByResult = await db.select({ result: scrutins.result, count: count() })
			.from(scrutins).where(scrutinWhereClause).groupBy(scrutins.result);

		const results = { adopté: 0, rejeté: 0 };
		for (const s of scrutinsByResult) {
			if (s.result === 'adopté') results.adopté = s.count;
			if (s.result === 'rejeté') results.rejeté = s.count;
		}
		return results;
	};

	// Monthly activity
	const loadMonthlyActivity = async () => {
		return await db.select({
			month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
			count: count()
		})
			.from(scrutins)
			.where(scrutinWhereClause)
			.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
			.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);
	};

	// Top participation
	const loadTopParticipation = async () => {
		const filteredScrutinsResult = scrutinConditions.length > 0
			? await db.select({ id: scrutins.id }).from(scrutins).where(scrutinWhereClause)
			: null;

		const filteredScrutinIds = filteredScrutinsResult?.map((s) => s.id) ?? null;

		const topParticipationRaw = filteredScrutinIds !== null
			? filteredScrutinIds.length > 0
				? await db.select({
						id: actors.id,
						name: actors.fullName,
						photoUrl: actors.photoUrl,
						voteCount: count(votes.id)
					})
					.from(votes)
					.innerJoin(actors, eq(votes.actorId, actors.id))
					.where(inArray(votes.scrutinId, filteredScrutinIds))
					.groupBy(actors.id, actors.fullName, actors.photoUrl)
					.orderBy(desc(count(votes.id)))
					.limit(10)
				: []
			: await db.select({
					id: actors.id,
					name: actors.fullName,
					photoUrl: actors.photoUrl,
					voteCount: count(votes.id)
				})
				.from(votes)
				.innerJoin(actors, eq(votes.actorId, actors.id))
				.groupBy(actors.id, actors.fullName, actors.photoUrl)
				.orderBy(desc(count(votes.id)))
				.limit(10);

		// Get group info for top deputies
		const topDeputyIds = topParticipationRaw.map(d => d.id);
		const topDeputyGroups = topDeputyIds.length > 0
			? await db.select({
					actorId: mandates.actorId,
					groupId: organs.id,
					groupName: organs.name,
					groupShortName: organs.shortName,
					groupColor: organs.color
				})
				.from(mandates)
				.innerJoin(organs, eq(mandates.organId, organs.id))
				.where(and(
					inArray(mandates.actorId, topDeputyIds),
					eq(organs.type, 'GP'),
					notLike(organs.id, 'PO_GP_%')
				))
			: [];

		const groupByDeputy = new Map<string, { id: string; name: string | null; shortName: string | null; color: string | null }>();
		for (const g of topDeputyGroups) {
			if (!groupByDeputy.has(g.actorId) && g.groupId) {
				groupByDeputy.set(g.actorId, {
					id: g.groupId,
					name: g.groupName,
					shortName: g.groupShortName,
					color: g.groupColor
				});
			}
		}

		return topParticipationRaw.map(d => ({
			...d,
			group: groupByDeputy.get(d.id) || null
		}));
	};

	// Group stats
	const loadGroupStats = async () => {
		const filteredScrutinsResult = scrutinConditions.length > 0
			? await db.select({ id: scrutins.id }).from(scrutins).where(scrutinWhereClause)
			: null;

		const filteredScrutinIds = filteredScrutinsResult?.map((s) => s.id) ?? null;

		return filteredScrutinIds !== null
			? filteredScrutinIds.length > 0
				? await db.select({
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
					.orderBy(desc(count(votes.id)))
				: await db.select({
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
					.where(groupCondition)
					.groupBy(organs.id, organs.name, organs.shortName, organs.color)
			: await db.select({
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
				.leftJoin(votes, eq(votes.groupId, organs.id))
				.where(groupCondition)
				.groupBy(organs.id, organs.name, organs.shortName, organs.color)
				.orderBy(desc(count(votes.id)));
	};

	// Heatmap and proximity matrix (these depend on each other)
	const loadHeatmapAndProximity = async () => {
		const [recentScrutins, groupStats] = await Promise.all([
			db.select({
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

		const heatmapData = scrutinIds.length > 0 && groupIds.length > 0
			? await db.select({
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

	// Government alignment
	const loadGovernmentAlignment = async () => {
		const [filteredScrutinsResult, majorityGroups, groupStats] = await Promise.all([
			scrutinConditions.length > 0
				? db.select({ id: scrutins.id }).from(scrutins).where(scrutinWhereClause)
				: Promise.resolve(null),
			db.select({ id: organs.id })
				.from(organs)
				.where(and(
					eq(organs.type, 'GP'),
					inArray(organs.shortName, ['EPR', 'RE', 'REN', 'Dem', 'HOR'])
				)),
			loadGroupStats()
		]);

		const filteredScrutinIds = filteredScrutinsResult?.map((s) => s.id) ?? null;
		const majorityGroupIds = majorityGroups.map(g => g.id);
		const activeGroups = groupStats.filter((g) => g.totalVotes > 0);

		// Get majority votes
		const majorityVotes = filteredScrutinIds !== null && filteredScrutinIds.length === 0
			? []
			: majorityGroupIds.length > 0
				? await db.select({
						scrutinId: votes.scrutinId,
						position: votes.position,
						count: count()
					})
					.from(votes)
					.where(filteredScrutinIds !== null && filteredScrutinIds.length > 0
						? and(inArray(votes.groupId, majorityGroupIds), inArray(votes.scrutinId, filteredScrutinIds))
						: inArray(votes.groupId, majorityGroupIds))
					.groupBy(votes.scrutinId, votes.position)
				: [];

		// Get all group votes for alignment calculation
		const groupIds = activeGroups.map(g => g.groupId);
		const scrutinIdsForAlignment = [...new Set(majorityVotes.map(v => v.scrutinId))];

		const groupVotes = scrutinIdsForAlignment.length > 0 && groupIds.length > 0
			? await db.select({
					scrutinId: votes.scrutinId,
					groupId: votes.groupId,
					position: votes.position,
					count: count()
				})
				.from(votes)
				.where(and(
					inArray(votes.scrutinId, scrutinIdsForAlignment),
					inArray(votes.groupId, groupIds)
				))
				.groupBy(votes.scrutinId, votes.groupId, votes.position)
			: [];

		// Calculate majority position per scrutin
		const majorityPosition: Record<string, string> = {};
		const scrutinMajorityCounts: Record<string, Record<string, number>> = {};

		for (const row of majorityVotes) {
			if (!scrutinMajorityCounts[row.scrutinId]) {
				scrutinMajorityCounts[row.scrutinId] = {};
			}
			scrutinMajorityCounts[row.scrutinId][row.position] = row.count;
		}

		for (const [scrutinId, positions] of Object.entries(scrutinMajorityCounts)) {
			let maxPos = 'pour';
			let maxCount = 0;
			for (const [pos, cnt] of Object.entries(positions)) {
				if (cnt > maxCount) {
					maxCount = cnt;
					maxPos = pos;
				}
			}
			majorityPosition[scrutinId] = maxPos;
		}

		// Calculate each group's majority position per scrutin
		const groupScrutinPosition: Record<string, Record<string, { position: string; count: number }>> = {};
		for (const row of groupVotes) {
			if (!row.groupId) continue;
			if (!groupScrutinPosition[row.groupId]) groupScrutinPosition[row.groupId] = {};
			const current = groupScrutinPosition[row.groupId][row.scrutinId];
			if (!current || row.count > current.count) {
				groupScrutinPosition[row.groupId][row.scrutinId] = {
					position: row.position,
					count: row.count
				};
			}
		}

		// Calculate alignment
		const governmentAlignment: Array<{
			groupId: string;
			groupName: string;
			groupShortName: string | null;
			groupColor: string | null;
			alignmentRate: number;
			commonScrutins: number;
		}> = [];

		for (const g of activeGroups) {
			const groupPositions = groupScrutinPosition[g.groupId] || {};
			let aligned = 0;
			let total = 0;

			for (const [scrutinId, data] of Object.entries(groupPositions)) {
				if (majorityPosition[scrutinId]) {
					total++;
					if (data.position === majorityPosition[scrutinId]) {
						aligned++;
					}
				}
			}

			governmentAlignment.push({
				groupId: g.groupId,
				groupName: g.groupName,
				groupShortName: g.groupShortName,
				groupColor: g.groupColor,
				alignmentRate: total > 0 ? (aligned / total) * 100 : 0,
				commonScrutins: total
			});
		}

		governmentAlignment.sort((a, b) => b.alignmentRate - a.alignmentRate);
		return governmentAlignment;
	};

	// Position evolution
	const loadPositionEvolution = async () => {
		const filteredScrutinsResult = scrutinConditions.length > 0
			? await db.select({ id: scrutins.id }).from(scrutins).where(scrutinWhereClause)
			: null;

		const filteredScrutinIds = filteredScrutinsResult?.map((s) => s.id) ?? null;

		return filteredScrutinIds !== null && filteredScrutinIds.length === 0
			? []
			: await db.select({
					month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
					pour: sql<number>`count(case when ${votes.position} = 'pour' then 1 end)`,
					contre: sql<number>`count(case when ${votes.position} = 'contre' then 1 end)`,
					abstention: sql<number>`count(case when ${votes.position} = 'abstention' then 1 end)`,
					total: count()
				})
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(scrutinConditions.length > 0 ? and(...scrutinConditions) : undefined)
				.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
				.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);
	};

	// Return sync data immediately, async data as promises (streamed)
	return {
		filters,
		// These are streamed - page renders immediately with loading states
		totals: loadTotals(),
		distribution: loadDistribution(),
		scrutinResults: loadScrutinResults(),
		monthlyActivity: loadMonthlyActivity(),
		topParticipation: loadTopParticipation(),
		groupStats: loadGroupStats(),
		heatmapAndProximity: loadHeatmapAndProximity(),
		governmentAlignment: loadGovernmentAlignment(),
		positionEvolution: loadPositionEvolution()
	};
};
