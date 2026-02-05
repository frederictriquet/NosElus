import type { PageServerLoad } from './$types';
import {
	db,
	actors,
	votes,
	scrutins,
	organs,
	amendments,
	mandates,
	actorStats
} from '$lib/server/db';
import { eq, and, count, desc, sql, asc, type SQL } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getLegislatureDates } from '$lib/server/periods/an-legislatures';
import {
	mapVoteDistribution,
	getGroupMajorityPosition,
	calculateAutonomyStats,
	getActorLawsImplication,
	getActorTightVoteStats,
	DEFAULT_TIGHT_THRESHOLD
} from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params, locals }) => {
	const legislature = locals.periods.an;

	// Get actor (synchronous - needed for 404 and page structure)
	const [actor] = await db.select().from(actors).where(eq(actors.id, params.id));

	if (!actor) {
		throw error(404, { message: 'Député non trouvé' });
	}

	// Get legislature dates for filtering
	const periodDates =
		legislature && legislature !== 'all' ? await getLegislatureDates(legislature) : null;

	// Check if deputy had a mandate during this legislature
	const checkMandate = async (): Promise<boolean> => {
		if (!legislature || legislature === 'all') return true;

		const [mandate] = await db
			.select({ id: mandates.id })
			.from(mandates)
			.where(and(eq(mandates.actorId, params.id), eq(mandates.legislature, legislature)))
			.limit(1);

		return !!mandate;
	};

	const hadMandateDuringPeriod = await checkMandate();

	// Build vote conditions helper
	const buildVoteConditions = (): SQL[] => {
		const conditions: SQL[] = [eq(votes.actorId, params.id)];
		if (legislature && legislature !== 'all') {
			conditions.push(eq(scrutins.legislature, legislature));
		}
		return conditions;
	};

	// Get deputy's group (from most recent vote in period)
	const groupQuery = db
		.select({
			groupId: votes.groupId,
			groupName: organs.name,
			groupShortName: organs.shortName,
			groupColor: organs.color
		})
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.leftJoin(organs, eq(votes.groupId, organs.id))
		.where(and(...buildVoteConditions()))
		.orderBy(desc(scrutins.date))
		.limit(1);

	const [deputyGroup] = await groupQuery;

	// Loader for vote stats and distribution
	const loadVoteStats = async () => {
		const baseConditions = buildVoteConditions();

		const [[voteCountResult], voteDistribution, [firstVote], [lastVote]] = await Promise.all([
			db
				.select({ value: count() })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(and(...baseConditions)),
			db
				.select({ position: votes.position, count: count() })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(and(...baseConditions))
				.groupBy(votes.position),
			db
				.select({ date: scrutins.date })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(and(...baseConditions))
				.orderBy(asc(scrutins.date))
				.limit(1),
			db
				.select({ date: scrutins.date })
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
		// Get all votes for this deputy with scrutin group results
		const deputyVotes = await db
			.select({
				position: votes.position,
				groupId: votes.groupId,
				groupResults: scrutins.groupResults
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(and(...buildVoteConditions()));

		if (deputyVotes.length === 0) return null;

		let aligned = 0;
		let total = 0;

		for (const vote of deputyVotes) {
			if (!vote.groupId || !vote.groupResults) continue;

			const results = vote.groupResults as Record<string, Record<string, unknown>>;
			const groupData = results[vote.groupId];
			if (!groupData) continue;

			const groupPos = getGroupMajorityPosition(groupData);
			if (!groupPos) continue;

			total++;
			if (vote.position?.toLowerCase() === groupPos) {
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

	// Loader for autonomy stats (divergence from group)
	const loadAutonomyStats = async () => {
		if (!deputyGroup?.groupId) return null;

		return await calculateAutonomyStats(params.id, deputyGroup.groupId, {
			legislature,
			dateFrom: null,
			dateTo: null
		});
	};

	// Loader for career milestones
	const loadCareerMilestones = async () => {
		const voteStats = await loadVoteStats();
		const monthlyEvolution = await loadMonthlyEvolution();

		const careerMilestones: Array<{
			date: string;
			type: 'first_vote' | 'last_vote' | 'milestone';
			title: string;
			description?: string;
		}> = [];

		if (voteStats.timeline.firstVote) {
			careerMilestones.push({
				date: voteStats.timeline.firstVote,
				type: 'first_vote',
				title: 'Premier vote enregistré',
				description: "Début de l'activité parlementaire"
			});
		}

		if (monthlyEvolution.length > 12 && monthlyEvolution[0]) {
			const maxMonth = monthlyEvolution.reduce(
				(max, m) => (m.total > max.total ? m : max),
				monthlyEvolution[0]
			);
			careerMilestones.push({
				date: maxMonth.month + '-01',
				type: 'milestone',
				title: 'Mois le plus actif',
				description: `${maxMonth.total} votes en ${maxMonth.month}`
			});
		}

		if (
			voteStats.timeline.lastVote &&
			voteStats.timeline.firstVote &&
			voteStats.timeline.lastVote !== voteStats.timeline.firstVote
		) {
			careerMilestones.push({
				date: voteStats.timeline.lastVote,
				type: 'last_vote',
				title: 'Dernier vote enregistré',
				description: 'Activité la plus récente'
			});
		}

		careerMilestones.sort((a, b) => a.date.localeCompare(b.date));
		return careerMilestones;
	};

	// Loader for amendment stats (filtered by legislature if applicable)
	const loadAmendmentStats = async () => {
		const amendmentConditions: SQL[] = [eq(amendments.authorId, params.id)];
		if (legislature && legislature !== 'all') {
			amendmentConditions.push(eq(amendments.legislature, legislature));
		}

		const [[amendmentCount], amendmentDistribution] = await Promise.all([
			db
				.select({ value: count() })
				.from(amendments)
				.where(and(...amendmentConditions)),
			db
				.select({ status: amendments.status, count: count() })
				.from(amendments)
				.where(and(...amendmentConditions))
				.groupBy(amendments.status)
		]);

		const amendmentStats = {
			total: amendmentCount.value,
			adopte: 0,
			rejete: 0,
			retire: 0,
			tombe: 0,
			autre: 0
		};

		for (const a of amendmentDistribution) {
			const status = a.status?.toLowerCase() || '';
			if (status.includes('adopt')) {
				amendmentStats.adopte += a.count;
			} else if (status.includes('rejet')) {
				amendmentStats.rejete += a.count;
			} else if (status.includes('retir')) {
				amendmentStats.retire += a.count;
			} else if (status.includes('tomb')) {
				amendmentStats.tombe += a.count;
			} else {
				amendmentStats.autre += a.count;
			}
		}

		return amendmentStats;
	};

	// Loader for recent amendments (filtered by legislature if applicable)
	const loadRecentAmendments = async () => {
		const amendmentConditions: SQL[] = [eq(amendments.authorId, params.id)];
		if (legislature && legislature !== 'all') {
			amendmentConditions.push(eq(amendments.legislature, legislature));
		}

		return await db
			.select({
				id: amendments.id,
				number: amendments.number,
				article: amendments.article,
				status: amendments.status,
				depositDate: amendments.depositDate,
				exposeSommaire: amendments.exposeSommaire
			})
			.from(amendments)
			.where(and(...amendmentConditions))
			.orderBy(desc(amendments.depositDate))
			.limit(10);
	};

	// Loader for mandates (group memberships, committees, delegations)
	const loadMandates = async () => {
		const mandateConditions: SQL[] = [eq(mandates.actorId, params.id)];
		if (legislature && legislature !== 'all') {
			mandateConditions.push(eq(mandates.legislature, legislature));
		}

		return await db
			.select({
				id: mandates.id,
				organId: mandates.organId,
				organName: organs.name,
				organShortName: organs.shortName,
				organType: organs.type,
				organColor: organs.color,
				startDate: mandates.startDate,
				endDate: mandates.endDate,
				quality: mandates.quality,
				legislature: mandates.legislature,
				constituency: mandates.constituency
			})
			.from(mandates)
			.innerJoin(organs, eq(mandates.organId, organs.id))
			.where(and(...mandateConditions))
			.orderBy(desc(mandates.startDate));
	};

	// Get activity stats from NosDéputés.fr (if available)
	const [stats] = await db
		.select()
		.from(actorStats)
		.where(and(eq(actorStats.actorId, params.id), eq(actorStats.source, 'nosdeputes')));

	// Loader for laws implication (author/cosignatory)
	const loadLawsImplication = async () => {
		return getActorLawsImplication(params.id, 20);
	};

	// Loader for tight votes stats
	const loadTightVoteStats = async () => {
		// Only pass legislature filter (actorId is passed directly to helper)
		const whereClause =
			legislature && legislature !== 'all' ? eq(scrutins.legislature, legislature) : undefined;
		return getActorTightVoteStats(params.id, DEFAULT_TIGHT_THRESHOLD, whereClause, 5);
	};

	return {
		// Synchronous data
		actor,
		group: deputyGroup || null,
		activityStats: stats || null,
		periodDates,
		hadMandateDuringPeriod,
		filters: {
			legislature
		},
		// Streamed data
		voteStats: loadVoteStats(),
		recentVotes: loadRecentVotes(),
		monthlyEvolution: loadMonthlyEvolution(),
		groupAlignment: loadGroupAlignment(),
		autonomyStats: loadAutonomyStats(),
		careerMilestones: loadCareerMilestones(),
		amendmentStats: loadAmendmentStats(),
		recentAmendments: loadRecentAmendments(),
		mandates: loadMandates(),
		lawsImplication: loadLawsImplication(),
		tightVoteStats: loadTightVoteStats()
	};
};
