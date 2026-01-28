import type { PageServerLoad } from './$types';
import { db, actors, votes, scrutins, organs } from '$lib/server/db';
import { count, eq, sql, desc } from 'drizzle-orm';

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
		monthlyActivity
	};
};
