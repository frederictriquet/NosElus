import type { PageServerLoad } from './$types';
import { db, organs, votes, actors, scrutins } from '$lib/server/db';
import { eq, count, sql, desc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const [group] = await db
		.select()
		.from(organs)
		.where(eq(organs.id, params.id));

	if (!group) {
		throw error(404, { message: 'Groupe non trouvé' });
	}

	// Get vote distribution for this group
	const voteDistribution = await db
		.select({
			position: votes.position,
			count: count()
		})
		.from(votes)
		.where(eq(votes.groupId, params.id))
		.groupBy(votes.position);

	const distribution = { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 };
	for (const v of voteDistribution) {
		if (v.position in distribution) {
			distribution[v.position as keyof typeof distribution] = v.count;
		}
	}

	// Get members count and list of top voters
	const members = await db
		.select({
			id: actors.id,
			name: actors.fullName,
			photoUrl: actors.photoUrl,
			voteCount: count(votes.id)
		})
		.from(actors)
		.innerJoin(votes, eq(votes.actorId, actors.id))
		.where(eq(votes.groupId, params.id))
		.groupBy(actors.id, actors.fullName, actors.photoUrl)
		.orderBy(desc(count(votes.id)))
		.limit(10);

	// Monthly activity
	const monthlyActivity = await db
		.select({
			month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
			total: count(),
			pour: sql<number>`count(case when ${votes.position} = 'pour' then 1 end)`,
			contre: sql<number>`count(case when ${votes.position} = 'contre' then 1 end)`,
			abstention: sql<number>`count(case when ${votes.position} = 'abstention' then 1 end)`
		})
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.where(eq(votes.groupId, params.id))
		.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
		.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);

	// Total vote count
	const [totalVotes] = await db
		.select({ value: count() })
		.from(votes)
		.where(eq(votes.groupId, params.id));

	return {
		group,
		distribution,
		members,
		monthlyActivity,
		totalVotes: totalVotes.value
	};
};
