import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins } from '$lib/server/db';
import { eq, count, desc, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Get actor
	const [actor] = await db
		.select()
		.from(actors)
		.where(eq(actors.id, params.id));

	if (!actor) {
		throw error(404, 'Député non trouvé');
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

	return {
		actor,
		voteCount: voteCount.value,
		recentVotes,
		distribution,
		monthlyEvolution
	};
};
