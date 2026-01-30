import type { PageServerLoad } from './$types';
import { db, actors, mandates, organs, votes, scrutins } from '$lib/server/db';
import { eq, and, count, desc, asc, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Get MEP actor
	const [actor] = await db
		.select()
		.from(actors)
		.where(and(eq(actors.id, params.id), eq(actors.chamber, 'PE')));

	if (!actor) {
		throw error(404, { message: 'Eurodéputé non trouvé' });
	}

	// Get MEP's political group (from mandates)
	const [mepGroup] = await db
		.select({
			groupId: organs.id,
			groupName: organs.name,
			groupShortName: organs.shortName,
			groupColor: organs.color
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(and(eq(mandates.actorId, params.id), eq(organs.type, 'GP')))
		.limit(1);

	// Get all mandates for this MEP
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
		.where(eq(mandates.actorId, params.id));

	// Loader for vote stats
	const loadVoteStats = async () => {
		const [[voteCountResult], voteDistribution, [firstVote], [lastVote]] = await Promise.all([
			db.select({ value: count() }).from(votes).where(eq(votes.actorId, params.id)),
			db
				.select({ position: votes.position, count: count() })
				.from(votes)
				.where(eq(votes.actorId, params.id))
				.groupBy(votes.position),
			db
				.select({ date: scrutins.date })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(eq(votes.actorId, params.id))
				.orderBy(asc(scrutins.date))
				.limit(1),
			db
				.select({ date: scrutins.date })
				.from(votes)
				.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
				.where(eq(votes.actorId, params.id))
				.orderBy(desc(scrutins.date))
				.limit(1)
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

	return {
		actor,
		group: mepGroup || null,
		mandates: mepMandates,
		// Streamed data
		voteStats: loadVoteStats(),
		recentVotes: loadRecentVotes(),
		monthlyEvolution: loadMonthlyEvolution()
	};
};
