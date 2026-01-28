import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, organs } from '$lib/server/db';
import { count, eq, sql, desc, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Total counts
	const [totalActors] = await db.select({ value: count() }).from(actors);
	const [totalVotes] = await db.select({ value: count() }).from(votes);
	const [totalScrutins] = await db.select({ value: count() }).from(scrutins);

	// Vote distribution
	const voteDistribution = await db
		.select({
			position: votes.position,
			count: count()
		})
		.from(votes)
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
	const topParticipation = await db
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

	// Scrutins by result
	const scrutinsByResult = await db
		.select({
			result: scrutins.result,
			count: count()
		})
		.from(scrutins)
		.groupBy(scrutins.result);

	const results = { adopté: 0, rejeté: 0 };
	for (const s of scrutinsByResult) {
		if (s.result === 'adopté') results.adopté = s.count;
		if (s.result === 'rejeté') results.rejeté = s.count;
	}

	// Group cohesion (percentage of votes aligned with group majority)
	// This is a simplified version - we calculate % of "pour" votes per group
	const groupStats = await db
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
		.where(eq(organs.type, 'GP'))
		.groupBy(organs.id, organs.name, organs.shortName, organs.color)
		.orderBy(desc(count(votes.id)));

	// Monthly vote activity
	const monthlyActivity = await db
		.select({
			month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
			count: count()
		})
		.from(scrutins)
		.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
		.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);

	// Get groups with votes for proximity matrix
	const activeGroups = groupStats.filter((g) => g.totalVotes > 0);
	const groupIds = activeGroups.map((g) => g.groupId);

	// Heatmap: Get recent scrutins with group votes
	const recentScrutins = await db
		.select({
			id: scrutins.id,
			title: scrutins.title,
			date: scrutins.date,
			result: scrutins.result
		})
		.from(scrutins)
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
		}
	};
};
