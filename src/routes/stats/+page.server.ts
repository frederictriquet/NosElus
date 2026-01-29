import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, organs, mandates } from '$lib/server/db';
import { count, eq, sql, desc, inArray, and, gte, lte, notLike, isNull, or, type SQL } from 'drizzle-orm';
import { parsePeriodFilters } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ url }) => {
	const periodFilters = parsePeriodFilters(url);

	// Build scrutin filter conditions
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

	const scrutinWhereClause = scrutinConditions.length > 0 ? and(...scrutinConditions) : undefined;

	// Get filtered scrutin IDs for vote filtering
	let filteredScrutinIds: string[] | null = null;
	if (scrutinConditions.length > 0) {
		const filteredScrutins = await db
			.select({ id: scrutins.id })
			.from(scrutins)
			.where(scrutinWhereClause);
		filteredScrutinIds = filteredScrutins.map((s) => s.id);
	}

	// Vote filter clause
	const voteWhereClause = filteredScrutinIds !== null && filteredScrutinIds.length > 0
		? inArray(votes.scrutinId, filteredScrutinIds)
		: filteredScrutinIds !== null
			? sql`1 = 0` // No scrutins match = no votes
			: undefined;

	// Get actors in legislature (for filtered count)
	let actorIdsInLegislature: string[] | null = null;
	if (periodFilters.legislature) {
		const mandatesInLeg = await db
			.selectDistinct({ actorId: mandates.actorId })
			.from(mandates)
			.where(eq(mandates.legislature, periodFilters.legislature));
		actorIdsInLegislature = mandatesInLeg.map((m) => m.actorId);
	}

	// Total counts (filtered)
	const [totalActors] = actorIdsInLegislature !== null
		? actorIdsInLegislature.length > 0
			? await db.select({ value: count() }).from(actors).where(inArray(actors.id, actorIdsInLegislature))
			: [{ value: 0 }]
		: await db.select({ value: count() }).from(actors);

	const [totalVotes] = filteredScrutinIds !== null && filteredScrutinIds.length === 0
		? [{ value: 0 }]
		: await db.select({ value: count() }).from(votes).where(voteWhereClause);

	const [totalScrutins] = await db.select({ value: count() }).from(scrutins).where(scrutinWhereClause);

	// Vote distribution (filtered)
	const voteDistribution = filteredScrutinIds !== null && filteredScrutinIds.length === 0
		? []
		: await db
			.select({
				position: votes.position,
				count: count()
			})
			.from(votes)
			.where(voteWhereClause)
			.groupBy(votes.position);

	const distribution = {
		pour: 0,
		contre: 0,
		abstention: 0,
		'non-votant': 0
	};
	for (const v of voteDistribution) {
		if (v.position in distribution) {
			distribution[v.position as keyof typeof distribution] = v.count;
		}
	}

	// Top deputies by participation (most votes cast)
	// When filtered, only consider votes in filtered scrutins
	const topParticipationQuery = filteredScrutinIds !== null
		? filteredScrutinIds.length > 0
			? db
				.select({
					id: actors.id,
					name: actors.fullName,
					photoUrl: actors.photoUrl,
					voteCount: count(votes.id)
				})
				.from(actors)
				.leftJoin(votes, and(eq(votes.actorId, actors.id), inArray(votes.scrutinId, filteredScrutinIds)))
				.groupBy(actors.id, actors.fullName, actors.photoUrl)
				.orderBy(desc(count(votes.id)))
				.limit(10)
			: Promise.resolve([])
		: db
			.select({
				id: actors.id,
				name: actors.fullName,
				photoUrl: actors.photoUrl,
				voteCount: count(votes.id)
			})
			.from(actors)
			.leftJoin(votes, eq(votes.actorId, actors.id))
			.groupBy(actors.id, actors.fullName, actors.photoUrl)
			.orderBy(desc(count(votes.id)))
			.limit(10);

	const topParticipation = await topParticipationQuery;

	// Scrutins by result (filtered)
	const scrutinsByResult = await db
		.select({
			result: scrutins.result,
			count: count()
		})
		.from(scrutins)
		.where(scrutinWhereClause)
		.groupBy(scrutins.result);

	const results = { adopté: 0, rejeté: 0 };
	for (const s of scrutinsByResult) {
		if (s.result === 'adopté') results.adopté = s.count;
		if (s.result === 'rejeté') results.rejeté = s.count;
	}

	// Group cohesion (percentage of votes aligned with group majority)
	// This is a simplified version - we calculate % of "pour" votes per group
	// Exclude PO_GP_* groups (imported from NosDéputés) to avoid duplicates
	// Exclude groups that have ended (endDate in the past) to avoid showing old versions
	const today = new Date().toISOString().split('T')[0];
	const groupCondition = and(
		eq(organs.type, 'GP'),
		notLike(organs.id, 'PO_GP_%'),
		or(isNull(organs.endDate), gte(organs.endDate, today))
	);

	const groupStatsQuery = filteredScrutinIds !== null
		? filteredScrutinIds.length > 0
			? db
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
				.orderBy(desc(count(votes.id)))
			: db
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
				.where(groupCondition)
				.groupBy(organs.id, organs.name, organs.shortName, organs.color)
		: db
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
			.leftJoin(votes, eq(votes.groupId, organs.id))
			.where(groupCondition)
			.groupBy(organs.id, organs.name, organs.shortName, organs.color)
			.orderBy(desc(count(votes.id)));

	const groupStats = await groupStatsQuery;

	// Monthly vote activity (filtered)
	const monthlyActivity = await db
		.select({
			month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
			count: count()
		})
		.from(scrutins)
		.where(scrutinWhereClause)
		.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
		.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);

	// Get groups with votes for proximity matrix
	const activeGroups = groupStats.filter((g) => g.totalVotes > 0);
	const groupIds = activeGroups.map((g) => g.groupId);

	// Heatmap: Get recent scrutins with group votes (filtered)
	const recentScrutins = await db
		.select({
			id: scrutins.id,
			title: scrutins.title,
			date: scrutins.date,
			result: scrutins.result
		})
		.from(scrutins)
		.where(scrutinWhereClause)
		.orderBy(desc(scrutins.date))
		.limit(15);

	const scrutinIds = recentScrutins.map((s) => s.id);

	// Get votes for heatmap (group positions per scrutin)
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

	// Build heatmap matrix: for each scrutin and group, determine majority position
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

	// Calculate group proximity matrix (how often groups vote the same way)
	const proximityMatrix: Record<string, Record<string, number>> = {};
	const pairCounts: Record<string, Record<string, { same: number; total: number }>> = {};

	// Initialize
	for (const g1 of groupIds) {
		proximityMatrix[g1] = {};
		pairCounts[g1] = {};
		for (const g2 of groupIds) {
			pairCounts[g1][g2] = { same: 0, total: 0 };
		}
	}

	// Count agreements per scrutin
	for (const scrutinId of Object.keys(heatmapMatrix)) {
		const scrutinVotes = heatmapMatrix[scrutinId];
		const votingGroups = Object.keys(scrutinVotes);

		for (let i = 0; i < votingGroups.length; i++) {
			for (let j = i + 1; j < votingGroups.length; j++) {
				const g1 = votingGroups[i];
				const g2 = votingGroups[j];
				pairCounts[g1][g2].total++;
				pairCounts[g2][g1].total++;
				if (scrutinVotes[g1].position === scrutinVotes[g2].position) {
					pairCounts[g1][g2].same++;
					pairCounts[g2][g1].same++;
				}
			}
		}
	}

	// Calculate percentages
	for (const g1 of groupIds) {
		for (const g2 of groupIds) {
			if (g1 === g2) {
				proximityMatrix[g1][g2] = 100;
			} else if (pairCounts[g1][g2].total > 0) {
				proximityMatrix[g1][g2] = Math.round(
					(pairCounts[g1][g2].same / pairCounts[g1][g2].total) * 100
				);
			} else {
				proximityMatrix[g1][g2] = 0;
			}
		}
	}

	// ===== GOVERNMENT ALIGNMENT =====
	// Presidential majority groups: Renaissance/EPR, MoDem/Dem, Horizons/HOR
	// Find these groups dynamically by their shortName
	const majorityShortNames = ['EPR', 'RE', 'REN', 'Dem', 'HOR'];
	const majorityGroups = await db
		.select({ id: organs.id })
		.from(organs)
		.where(and(
			eq(organs.type, 'GP'),
			inArray(organs.shortName, majorityShortNames)
		));
	const majorityGroupIds = majorityGroups.map(g => g.id);

	// For each scrutin, determine majority position (what did majority vote for)
	const majorityVotesConditions: SQL[] = majorityGroupIds.length > 0
		? [inArray(votes.groupId, majorityGroupIds)]
		: [sql`1 = 0`]; // No majority groups found
	if (filteredScrutinIds !== null && filteredScrutinIds.length > 0) {
		majorityVotesConditions.push(inArray(votes.scrutinId, filteredScrutinIds));
	}

	const majorityVotes = filteredScrutinIds !== null && filteredScrutinIds.length === 0
		? []
		: await db
			.select({
				scrutinId: votes.scrutinId,
				position: votes.position,
				count: count()
			})
			.from(votes)
			.where(and(...majorityVotesConditions))
			.groupBy(votes.scrutinId, votes.position);

	// Build majority position per scrutin
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

	// Calculate alignment per group (how often they vote with majority)
	const groupAlignmentData = filteredScrutinIds !== null && filteredScrutinIds.length === 0
		? []
		: filteredScrutinIds !== null
			? await db
				.select({
					groupId: votes.groupId,
					scrutinId: votes.scrutinId,
					position: votes.position,
					count: count()
				})
				.from(votes)
				.where(inArray(votes.scrutinId, filteredScrutinIds))
				.groupBy(votes.groupId, votes.scrutinId, votes.position)
			: await db
				.select({
					groupId: votes.groupId,
					scrutinId: votes.scrutinId,
					position: votes.position,
					count: count()
				})
				.from(votes)
				.groupBy(votes.groupId, votes.scrutinId, votes.position);

	// Build group majority position per scrutin
	const groupScrutinPosition: Record<string, Record<string, string>> = {};
	const tempCounts: Record<string, Record<string, Record<string, number>>> = {};

	for (const row of groupAlignmentData) {
		if (!row.groupId) continue;
		if (!tempCounts[row.groupId]) tempCounts[row.groupId] = {};
		if (!tempCounts[row.groupId][row.scrutinId]) tempCounts[row.groupId][row.scrutinId] = {};
		tempCounts[row.groupId][row.scrutinId][row.position] = row.count;
	}

	for (const [gId, scrutins] of Object.entries(tempCounts)) {
		groupScrutinPosition[gId] = {};
		for (const [sId, positions] of Object.entries(scrutins)) {
			let maxPos = 'pour';
			let maxCount = 0;
			for (const [pos, cnt] of Object.entries(positions)) {
				if (cnt > maxCount) {
					maxCount = cnt;
					maxPos = pos;
				}
			}
			groupScrutinPosition[gId][sId] = maxPos;
		}
	}

	// Calculate alignment rate per group
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

		for (const [scrutinId, groupPos] of Object.entries(groupPositions)) {
			if (majorityPosition[scrutinId]) {
				total++;
				if (groupPos === majorityPosition[scrutinId]) {
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

	// ===== POSITION EVOLUTION OVER TIME =====
	// Calculate monthly ratio of pour vs contre votes globally (filtered)
	const positionEvolutionConditions: SQL[] = [];
	if (scrutinConditions.length > 0) {
		positionEvolutionConditions.push(...scrutinConditions);
	}

	const positionEvolution = filteredScrutinIds !== null && filteredScrutinIds.length === 0
		? []
		: await db
			.select({
				month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
				pour: sql<number>`count(case when ${votes.position} = 'pour' then 1 end)`,
				contre: sql<number>`count(case when ${votes.position} = 'contre' then 1 end)`,
				abstention: sql<number>`count(case when ${votes.position} = 'abstention' then 1 end)`,
				total: count()
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(positionEvolutionConditions.length > 0 ? and(...positionEvolutionConditions) : undefined)
			.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
			.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);

	return {
		totals: {
			actors: totalActors.value,
			votes: totalVotes.value,
			scrutins: totalScrutins.value
		},
		distribution,
		topParticipation,
		scrutinResults: results,
		groupStats,
		monthlyActivity,
		// Phase 4 additions
		heatmap: {
			scrutins: recentScrutins,
			groups: activeGroups.map((g) => ({
				id: g.groupId,
				name: g.groupShortName || g.groupName,
				color: g.groupColor
			})),
			matrix: heatmapMatrix
		},
		proximityMatrix: {
			groups: activeGroups.map((g) => ({
				id: g.groupId,
				name: g.groupShortName || g.groupName,
				color: g.groupColor
			})),
			matrix: proximityMatrix
		},
		governmentAlignment,
		positionEvolution,
		filters: {
			legislature: periodFilters.legislature,
			dateFrom: periodFilters.dateFrom,
			dateTo: periodFilters.dateTo
		}
	};
};
