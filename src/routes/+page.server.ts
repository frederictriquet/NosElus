import type { PageServerLoad } from './$types';
import { db, actors, scrutins, votes, organs } from '$lib/server/db';
import { count, desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Get stats
	const [deputiesCount] = await db.select({ value: count() }).from(actors);
	const [scrutinsCount] = await db.select({ value: count() }).from(scrutins);
	const [votesCount] = await db.select({ value: count() }).from(votes);
	const [groupsCount] = await db.select({ value: count() }).from(organs).where(eq(organs.type, 'GP'));

	// Get recent scrutins
	const recentScrutins = await db
		.select({
			id: scrutins.id,
			title: scrutins.title,
			date: scrutins.date,
			result: scrutins.result,
			totalVoters: scrutins.totalVoters,
			totalFor: scrutins.totalFor,
			totalAgainst: scrutins.totalAgainst,
			totalAbstention: scrutins.totalAbstention
		})
		.from(scrutins)
		.orderBy(desc(scrutins.date), desc(scrutins.number))
		.limit(5);

	// Get groups
	const groups = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			color: organs.color
		})
		.from(organs)
		.where(eq(organs.type, 'GP'))
		.orderBy(organs.name);

	return {
		stats: {
			deputies: deputiesCount.value,
			scrutins: scrutinsCount.value,
			votes: votesCount.value,
			groups: groupsCount.value
		},
		recentScrutins,
		groups
	};
};
