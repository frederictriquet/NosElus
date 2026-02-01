import type { PageServerLoad } from './$types';
import { db, organs, votes, actors, scrutins } from '$lib/server/db';
import { eq, count, sql, and, inArray, like } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getTermDates } from '$lib/server/periods/pe-terms';
import { calculateMonthlyCohesion } from '$lib/server/utils/cohesion';
import { mapVoteDistribution, getPEGroupMemberIds, type PeriodDates } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params, locals }) => {
	const terme = locals.periods.pe;

	// Get group info (synchronous - needed for 404 and page structure)
	const [group] = await db
		.select()
		.from(organs)
		.where(and(eq(organs.id, params.id), eq(organs.chamber, 'PE')));

	if (!group) {
		throw error(404, { message: 'Groupe non trouvé' });
	}

	// Get term dates for filtering
	const periodDates: PeriodDates | null = terme && terme !== 'all' ? await getTermDates(terme) : null;

	// Get PE scrutin IDs, filtered by term if specified
	const getPeScrutinIds = async (): Promise<string[]> => {
		const peScrutins = terme && terme !== 'all'
			? await db
				.select({ id: scrutins.id })
				.from(scrutins)
				.where(eq(scrutins.legislature, `PE-${terme}`))
			: await db
				.select({ id: scrutins.id })
				.from(scrutins)
				.where(like(scrutins.legislature, 'PE-%'));
		return peScrutins.map((s) => s.id);
	};

	// Loader for vote distribution
	const loadDistribution = async () => {
		const peScrutinIds = await getPeScrutinIds();

		if (peScrutinIds.length === 0) {
			return { distribution: { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 }, totalVotes: 0 };
		}

		const voteDistribution = await db
			.select({
				position: votes.position,
				count: count()
			})
			.from(votes)
			.where(and(eq(votes.groupId, group.id), inArray(votes.scrutinId, peScrutinIds)))
			.groupBy(votes.position);

		const distribution = mapVoteDistribution(voteDistribution);

		// Also get total votes count
		const [totalVotes] = await db
			.select({ value: count() })
			.from(votes)
			.where(and(eq(votes.groupId, group.id), inArray(votes.scrutinId, peScrutinIds)));

		return { distribution, totalVotes: totalVotes.value };
	};

	// Loader for group members (French MEPs in this group)
	const loadMembers = async () => {
		const memberIds = await getPEGroupMemberIds(group.id, terme, periodDates);
		if (memberIds.length === 0) return [];

		const members = await db
			.select({
				id: actors.id,
				name: actors.fullName,
				lastName: actors.lastName,
				photoUrl: actors.photoUrl
			})
			.from(actors)
			.where(inArray(actors.id, memberIds))
			.orderBy(actors.lastName)
			.limit(20);

		return members;
	};

	// Loader for monthly activity
	const loadMonthlyActivity = async () => {
		const peScrutinIds = await getPeScrutinIds();

		if (peScrutinIds.length === 0) {
			return [];
		}

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
			.where(and(eq(votes.groupId, group.id), inArray(votes.scrutinId, peScrutinIds)))
			.groupBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`)
			.orderBy(sql`to_char(${scrutins.date}, 'YYYY-MM')`);
	};

	// Loader for group cohesion over time
	const loadCohesion = async () => {
		const peScrutinIds = await getPeScrutinIds();

		if (peScrutinIds.length === 0) {
			return [];
		}

		const votesByScrutin = await db
			.select({
				scrutinId: votes.scrutinId,
				month: sql<string>`to_char(${scrutins.date}, 'YYYY-MM')`,
				pour: sql<number>`count(case when ${votes.position} = 'pour' then 1 end)`,
				contre: sql<number>`count(case when ${votes.position} = 'contre' then 1 end)`,
				abstention: sql<number>`count(case when ${votes.position} = 'abstention' then 1 end)`,
				total: count()
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(and(eq(votes.groupId, group.id), inArray(votes.scrutinId, peScrutinIds)))
			.groupBy(votes.scrutinId, sql`to_char(${scrutins.date}, 'YYYY-MM')`);

		return calculateMonthlyCohesion(votesByScrutin);
	};

	return {
		// Synchronous data
		group,
		filters: {
			terme
		},
		periodDates,
		// Streamed data
		distributionData: loadDistribution(),
		members: loadMembers(),
		monthlyActivity: loadMonthlyActivity(),
		cohesionData: loadCohesion()
	};
};
