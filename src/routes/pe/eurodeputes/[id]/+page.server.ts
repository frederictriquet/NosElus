import type { PageServerLoad } from './$types';
import { db, actors, mandates, organs, votes, scrutins, actorStats } from '$lib/server/db';
import { eq, and, count, desc, asc, sql, inArray, like, type SQL } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getTermDates } from '$lib/server/periods/pe-terms';
import { mapVoteDistribution, getGroupMajorityPosition } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params, locals }) => {
	const terme = locals.periods.pe;
	// Get MEP actor
	const [actor] = await db
		.select()
		.from(actors)
		.where(and(eq(actors.id, params.id), eq(actors.chamber, 'PE')));

	if (!actor) {
		throw error(404, { message: 'Eurodéputé non trouvé' });
	}

	// Get term dates for filtering
	const termDates = terme && terme !== 'all' ? await getTermDates(terme) : null;

	// Check if MEP had a mandate during this term
	const checkMandate = async (): Promise<boolean> => {
		if (!terme || terme === 'all') return true;

		const [mandate] = await db
			.select({ id: mandates.id })
			.from(mandates)
			.where(and(
				eq(mandates.actorId, params.id),
				eq(mandates.legislature, terme)
			))
			.limit(1);

		return !!mandate;
	};

	const hadMandateDuringPeriod = await checkMandate();

	// Build vote conditions helper
	const buildVoteConditions = (): SQL[] => {
		const conditions: SQL[] = [eq(votes.actorId, params.id)];
		if (terme && terme !== 'all') {
			conditions.push(eq(scrutins.legislature, `PE-${terme}`));
		} else {
			conditions.push(like(scrutins.legislature, 'PE-%'));
		}
		return conditions;
	};

	// Build mandate filter conditions
	const buildMandateConditions = (): SQL[] => {
		const conditions: SQL[] = [eq(mandates.actorId, params.id)];
		if (terme && terme !== 'all') {
			conditions.push(eq(mandates.legislature, terme));
		}
		return conditions;
	};

	// Get MEP's political group (from mandates, filtered by term)
	const groupConditions = buildMandateConditions();
	groupConditions.push(eq(organs.type, 'GP'));
	const [mepGroup] = await db
		.select({
			groupId: organs.id,
			groupName: organs.name,
			groupShortName: organs.shortName,
			groupColor: organs.color
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(and(...groupConditions))
		.orderBy(desc(mandates.startDate))
		.limit(1);

	// Get all mandates for this MEP (filtered by term)
	const mepMandates = await db
		.select({
			id: mandates.id,
			organId: mandates.organId,
			organName: organs.name,
			organShortName: organs.shortName,
			organType: organs.type,
			startDate: mandates.startDate,
			endDate: mandates.endDate,
			quality: mandates.quality
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(and(...buildMandateConditions()))
		.orderBy(desc(mandates.startDate));

	// Loader for vote stats
	const loadVoteStats = async () => {
		const baseConditions = buildVoteConditions();

		const [[voteCountResult], voteDistribution, [firstVote], [lastVote]] = await Promise.all([
			db.select({ value: count() })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(and(...baseConditions)),
			db.select({ position: votes.position, count: count() })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(and(...baseConditions))
				.groupBy(votes.position),
			db.select({ date: scrutins.date })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(and(...baseConditions))
				.orderBy(asc(scrutins.date))
				.limit(1),
			db.select({ date: scrutins.date })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(and(...baseConditions))
				.orderBy(desc(scrutins.date))
				.limit(1)
		]);

		return {
			voteCount: voteCountResult.value,
			distribution: mapVoteDistribution(voteDistribution),
			timeline: {
				firstVote: firstVote?.date || null,
				lastVote: lastVote?.date || null
			}
		};
	};

	// Loader for recent votes
	const loadRecentVotes = async () => {
		return await db
			.select({
				id: votes.id,
				position: votes.position,
				scrutinId: scrutins.id,
				scrutinTitle: scrutins.title,
				scrutinDate: scrutins.date,
				scrutinResult: scrutins.result
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(and(...buildVoteConditions()))
			.orderBy(desc(scrutins.date))
			.limit(20);
	};

	// Loader for monthly evolution
	const loadMonthlyEvolution = async () => {
		return await db
			.select({
				month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
				total: count(),
				pour: sql<number>`count(case when ${votes.position} = 'pour' then 1 end)`,
				contre: sql<number>`count(case when ${votes.position} = 'contre' then 1 end)`,
				abstention: sql<number>`count(case when ${votes.position} = 'abstention' then 1 end)`,
				nonVotant: sql<number>`count(case when ${votes.position} = 'non-votant' then 1 end)`
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(and(...buildVoteConditions()))
			.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
			.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);
	};

	// Loader for group alignment rate
	const loadGroupAlignment = async () => {
		// Get all votes for this MEP with their group at time of vote (filtered by term)
		const mepVotes = await db
			.select({
				scrutinId: votes.scrutinId,
				position: votes.position,
				groupId: votes.groupId
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(and(...buildVoteConditions()));

		if (mepVotes.length === 0) return null;

		// Get unique group IDs from MEP's votes
		const groupIds = [...new Set(mepVotes.map((v) => v.groupId).filter(Boolean))] as string[];
		if (groupIds.length === 0) return null;

		// Get all group votes for the relevant scrutins and groups
		const scrutinIds = [...new Set(mepVotes.map((v) => v.scrutinId))];

		const groupVoteCounts = await db
			.select({
				scrutinId: votes.scrutinId,
				groupId: votes.groupId,
				position: votes.position,
				cnt: count()
			})
			.from(votes)
			.where(and(inArray(votes.scrutinId, scrutinIds), inArray(votes.groupId, groupIds)))
			.groupBy(votes.scrutinId, votes.groupId, votes.position);

		// Build map of majority position per scrutin per group
		// groupMajority[scrutinId][groupId] = majorityPosition
		const tempCounts: Record<string, Record<string, Record<string, number>>> = {};

		for (const row of groupVoteCounts) {
			if (!row.groupId) continue;
			if (!tempCounts[row.scrutinId]) {
				tempCounts[row.scrutinId] = {};
			}
			if (!tempCounts[row.scrutinId][row.groupId]) {
				tempCounts[row.scrutinId][row.groupId] = {};
			}
			tempCounts[row.scrutinId][row.groupId][row.position || ''] = row.cnt;
		}

		const groupMajority: Record<string, Record<string, string>> = {};
		for (const [scrutinId, groups] of Object.entries(tempCounts)) {
			groupMajority[scrutinId] = {};
			for (const [groupId, positions] of Object.entries(groups)) {
				let maxPos = 'pour';
				let maxCount = 0;
				for (const [pos, cnt] of Object.entries(positions)) {
					if (cnt > maxCount) {
						maxCount = cnt;
						maxPos = pos;
					}
				}
				groupMajority[scrutinId][groupId] = maxPos;
			}
		}

		// Calculate alignment - compare MEP's vote with their group's majority at time of vote
		let aligned = 0;
		let total = 0;

		for (const vote of mepVotes) {
			if (!vote.groupId) continue;
			const majorityPos = groupMajority[vote.scrutinId]?.[vote.groupId];
			if (!majorityPos) continue;

			total++;
			if (vote.position === majorityPos) {
				aligned++;
			}
		}

		if (total === 0) return null;

		return {
			alignmentRate: Math.round((aligned / total) * 100),
			alignedVotes: aligned,
			totalVotes: total,
			dissidentVotes: total - aligned
		};
	};

	// Get activity stats from HowTheyVote
	const [stats] = await db
		.select()
		.from(actorStats)
		.where(and(eq(actorStats.actorId, params.id), eq(actorStats.source, 'howtheyvote')));

	// Use term dates for the chart period, or compute from actual votes if no term filter
	const periodDates = termDates || null;

	return {
		actor,
		group: mepGroup || null,
		mandates: mepMandates,
		activityStats: stats || null,
		periodDates,
		hadMandateDuringPeriod,
		filters: {
			terme
		},
		// Streamed data
		voteStats: loadVoteStats(),
		recentVotes: loadRecentVotes(),
		monthlyEvolution: loadMonthlyEvolution(),
		groupAlignment: loadGroupAlignment()
	};
};
