import type { PageServerLoad } from './$types';
import { db, actors, scrutins, votes, organs, mandates } from '$lib/server/db';
import { count, desc, eq, and, countDistinct, sql } from 'drizzle-orm';
import { parsePeriodFilters } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ url }) => {
	const { legislature } = parsePeriodFilters(url);

	// Build conditions based on legislature filter
	const scrutinCondition = legislature ? eq(scrutins.legislature, legislature) : undefined;
	const groupCondition = legislature
		? and(eq(organs.type, 'GP'), eq(organs.legislature, legislature))
		: eq(organs.type, 'GP');

	// Get stats
	let deputiesCount: { value: number };
	if (legislature) {
		// Count deputies with a mandate in this legislature
		const [result] = await db
			.select({ value: countDistinct(mandates.actorId) })
			.from(mandates)
			.where(and(eq(mandates.type, 'depute'), eq(mandates.legislature, legislature)));
		deputiesCount = result;
	} else {
		const [result] = await db.select({ value: count() }).from(actors);
		deputiesCount = result;
	}

	const [scrutinsCount] = legislature
		? await db.select({ value: count() }).from(scrutins).where(scrutinCondition)
		: await db.select({ value: count() }).from(scrutins);

	const [votesCount] = legislature
		? await db
				.select({ value: count() })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(scrutinCondition)
		: await db.select({ value: count() }).from(votes);

	const [groupsCount] = await db.select({ value: count() }).from(organs).where(groupCondition);

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
		.where(scrutinCondition)
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
		.where(groupCondition)
		.orderBy(organs.name);

	return {
		stats: {
			deputies: deputiesCount.value,
			scrutins: scrutinsCount.value,
			votes: votesCount.value,
			groups: groupsCount.value
		},
		recentScrutins,
		groups,
		filters: {
			legislature
		}
	};
};
