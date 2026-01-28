import type { PageServerLoad } from './$types';
import { db, actors, votes, organs } from '$lib/server/db';
import { count, eq, sql, desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Get deputies count per group for visualization
	const groupDistribution = await db
		.select({
			groupId: organs.id,
			groupName: organs.name,
			groupShortName: organs.shortName,
			groupColor: organs.color,
			deputyCount: sql<number>`count(distinct ${votes.actorId})`
		})
		.from(organs)
		.leftJoin(votes, eq(votes.groupId, organs.id))
		.where(eq(organs.type, 'GP'))
		.groupBy(organs.id, organs.name, organs.shortName, organs.color)
		.orderBy(desc(sql`count(distinct ${votes.actorId})`));

	// Get total deputies
	const [totalDeputies] = await db.select({ value: count() }).from(actors);

	// Sample deputies per group (top 5 per group)
	const deputiesByGroup: Record<string, Array<{ id: string; name: string; photoUrl: string | null }>> = {};

	for (const group of groupDistribution.filter(g => g.deputyCount > 0)) {
		const deputies = await db
			.select({
				id: actors.id,
				name: actors.fullName,
				photoUrl: actors.photoUrl
			})
			.from(actors)
			.innerJoin(votes, eq(votes.actorId, actors.id))
			.where(eq(votes.groupId, group.groupId))
			.groupBy(actors.id, actors.fullName, actors.photoUrl)
			.orderBy(desc(count(votes.id)))
			.limit(5);

		deputiesByGroup[group.groupId] = deputies;
	}

	return {
		groupDistribution: groupDistribution.filter(g => g.deputyCount > 0),
		totalDeputies: totalDeputies.value,
		deputiesByGroup
	};
};
