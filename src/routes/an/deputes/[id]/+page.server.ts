import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, organs, amendments, mandates } from '$lib/server/db';
import { eq, count, desc, sql, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Get actor (synchronous - needed for 404 and page structure)
	const [actor] = await db
		.select()
		.from(actors)
		.where(eq(actors.id, params.id));

	if (!actor) {
		throw error(404, { message: 'Député non trouvé' });
	}

	// Get deputy's group (from most recent vote) - fast, needed for header
	const [deputyGroup] = await db
		.select({
			groupId: votes.groupId,
			groupName: organs.name,
			groupShortName: organs.shortName,
			groupColor: organs.color
		})
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.leftJoin(organs, eq(votes.groupId, organs.id))
		.where(eq(votes.actorId, params.id))
		.orderBy(desc(scrutins.date))
		.limit(1);

	// Loader for vote stats and distribution
	const loadVoteStats = async () => {
		const [[voteCountResult], voteDistribution, [firstVote], [lastVote]] = await Promise.all([
			db.select({ value: count() }).from(votes).where(eq(votes.actorId, params.id)),
			db.select({ position: votes.position, count: count() })
				.from(votes).where(eq(votes.actorId, params.id)).groupBy(votes.position),
			db.select({ date: scrutins.date })
				.from(votes).innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(eq(votes.actorId, params.id)).orderBy(asc(scrutins.date)).limit(1),
			db.select({ date: scrutins.date })
				.from(votes).innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(eq(votes.actorId, params.id)).orderBy(desc(scrutins.date)).limit(1)
		]);

		const distribution = { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 };
		for (const v of voteDistribution) {
			if (v.position in distribution) {
				distribution[v.position as keyof typeof distribution] = v.count;
			}
		}

		return {
			voteCount: voteCountResult.value,
			distribution,
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
			.where(eq(votes.actorId, params.id))
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
				abstention: sql<number>`count(case when ${votes.position} = 'abstention' then 1 end)`
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(eq(votes.actorId, params.id))
			.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
			.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);
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
				description: 'Début de l\'activité parlementaire'
			});
		}

		if (monthlyEvolution.length > 12 && monthlyEvolution[0]) {
			const maxMonth = monthlyEvolution.reduce((max, m) => m.total > max.total ? m : max, monthlyEvolution[0]);
			careerMilestones.push({
				date: maxMonth.month + '-01',
				type: 'milestone',
				title: 'Mois le plus actif',
				description: `${maxMonth.total} votes en ${maxMonth.month}`
			});
		}

		if (voteStats.timeline.lastVote && voteStats.timeline.firstVote && voteStats.timeline.lastVote !== voteStats.timeline.firstVote) {
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

	// Loader for amendment stats
	const loadAmendmentStats = async () => {
		const [[amendmentCount], amendmentDistribution] = await Promise.all([
			db.select({ value: count() }).from(amendments).where(eq(amendments.authorId, params.id)),
			db.select({ status: amendments.status, count: count() })
				.from(amendments).where(eq(amendments.authorId, params.id)).groupBy(amendments.status)
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

	// Loader for recent amendments
	const loadRecentAmendments = async () => {
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
			.where(eq(amendments.authorId, params.id))
			.orderBy(desc(amendments.depositDate))
			.limit(10);
	};

	// Loader for mandates (group memberships, committees, delegations)
	const loadMandates = async () => {
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
			.where(eq(mandates.actorId, params.id))
			.orderBy(desc(mandates.startDate));
	};

	return {
		// Synchronous data
		actor,
		group: deputyGroup || null,
		// Streamed data
		voteStats: loadVoteStats(),
		recentVotes: loadRecentVotes(),
		monthlyEvolution: loadMonthlyEvolution(),
		careerMilestones: loadCareerMilestones(),
		amendmentStats: loadAmendmentStats(),
		recentAmendments: loadRecentAmendments(),
		mandates: loadMandates()
	};
};
