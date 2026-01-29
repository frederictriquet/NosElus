import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, organs } from '$lib/server/db';
import { eq, count, desc, sql, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Get actor
	const [actor] = await db
		.select()
		.from(actors)
		.where(eq(actors.id, params.id));

	if (!actor) {
		throw error(404, { message: 'Député non trouvé' });
	}

	// Get vote stats
	const [voteCount] = await db
		.select({ value: count() })
		.from(votes)
		.where(eq(votes.actorId, params.id));

	// Get recent votes with scrutin info
	const recentVotes = await db
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

	// Calculate vote distribution
	const voteDistribution = await db
		.select({
			position: votes.position,
			count: count()
		})
		.from(votes)
		.where(eq(votes.actorId, params.id))
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

	// Evolution temporelle: votes par mois avec répartition
	const monthlyEvolution = await db
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

	// Timeline: first and last vote dates
	const [firstVote] = await db
		.select({ date: scrutins.date })
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.where(eq(votes.actorId, params.id))
		.orderBy(asc(scrutins.date))
		.limit(1);

	const [lastVote] = await db
		.select({ date: scrutins.date })
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.where(eq(votes.actorId, params.id))
		.orderBy(desc(scrutins.date))
		.limit(1);

	// Get deputy's group (from most recent vote)
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

	// Career milestones: key votes and activity markers
	const careerMilestones: Array<{
		date: string;
		type: 'first_vote' | 'last_vote' | 'milestone';
		title: string;
		description?: string;
	}> = [];

	if (firstVote) {
		careerMilestones.push({
			date: firstVote.date,
			type: 'first_vote',
			title: 'Premier vote enregistré',
			description: 'Début de l\'activité parlementaire'
		});
	}

	// Add yearly milestones if we have enough data
	if (monthlyEvolution.length > 12 && monthlyEvolution[0]) {
		// Find the month with most activity
		const maxMonth = monthlyEvolution.reduce((max, m) => m.total > max.total ? m : max, monthlyEvolution[0]);
		careerMilestones.push({
			date: maxMonth.month + '-01',
			type: 'milestone',
			title: 'Mois le plus actif',
			description: `${maxMonth.total} votes en ${maxMonth.month}`
		});
	}

	if (lastVote && firstVote && lastVote.date !== firstVote.date) {
		careerMilestones.push({
			date: lastVote.date,
			type: 'last_vote',
			title: 'Dernier vote enregistré',
			description: 'Activité la plus récente'
		});
	}

	careerMilestones.sort((a, b) => a.date.localeCompare(b.date));

	return {
		actor,
		voteCount: voteCount.value,
		recentVotes,
		distribution,
		monthlyEvolution,
		timeline: {
			firstVote: firstVote?.date || null,
			lastVote: lastVote?.date || null
		},
		group: deputyGroup || null,
		careerMilestones
	};
};
