import type { PageServerLoad } from './$types';
import { db, organs, actors, actorStats } from '$lib/server/db';
import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getRenouvellementDates } from '$lib/server/periods/senat-renouvellements';
import {
	getSenatGroupMemberIds,
	getYearsInPeriod,
	type PeriodDates
} from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params, locals }) => {
	const renouvellement = locals.periods.senat;

	// Get group info
	const [group] = await db
		.select()
		.from(organs)
		.where(and(eq(organs.id, params.id), eq(organs.chamber, 'SENAT'), eq(organs.type, 'GP')));

	if (!group) {
		throw error(404, { message: 'Groupe non trouvé' });
	}

	// Get renouvellement dates for filtering
	const periodDates: PeriodDates | null =
		renouvellement && renouvellement !== 'all'
			? await getRenouvellementDates(renouvellement)
			: null;

	// Loader for group members
	const loadMembers = async () => {
		const memberIds = await getSenatGroupMemberIds(group.id, periodDates);
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
			.orderBy(actors.lastName);

		return members;
	};

	// Loader for aggregated activity stats of group members
	const loadGroupStats = async () => {
		const memberIds = await getSenatGroupMemberIds(group.id, periodDates);
		if (memberIds.length === 0) return null;

		// Build stats period filter
		const statsConditions = [inArray(actorStats.actorId, memberIds)];
		if (periodDates) {
			const years = getYearsInPeriod(periodDates.start, periodDates.end);
			statsConditions.push(inArray(actorStats.period, years));
		} else {
			statsConditions.push(eq(actorStats.period, 'all'));
		}

		// Aggregate stats for all members
		const [aggregated] = await db
			.select({
				weeksPresent: sql<number>`SUM(${actorStats.weeksPresent})`,
				commissionPresences: sql<number>`SUM(${actorStats.commissionPresences})`,
				hemicycleInterventions: sql<number>`SUM(${actorStats.hemicycleInterventions})`,
				commissionInterventions: sql<number>`SUM(${actorStats.commissionInterventions})`,
				amendmentsSigned: sql<number>`SUM(${actorStats.amendmentsSigned})`,
				amendmentsAdopted: sql<number>`SUM(${actorStats.amendmentsAdopted})`,
				reports: sql<number>`SUM(${actorStats.reports})`,
				writtenQuestions: sql<number>`SUM(${actorStats.writtenQuestions})`,
				oralQuestions: sql<number>`SUM(${actorStats.oralQuestions})`
			})
			.from(actorStats)
			.where(and(...statsConditions));

		return aggregated;
	};

	// Loader for most active senators in the group
	const loadTopMembers = async () => {
		const memberIds = await getSenatGroupMemberIds(group.id, periodDates);
		if (memberIds.length === 0) return [];

		// Build period filter for stats
		const periodFilter = periodDates
			? inArray(actorStats.period, getYearsInPeriod(periodDates.start, periodDates.end))
			: eq(actorStats.period, 'all');

		// Get aggregated stats per actor for the selected period
		const topMembers = await db
			.select({
				id: actors.id,
				name: actors.fullName,
				lastName: actors.lastName,
				photoUrl: actors.photoUrl,
				hemicycleInterventions: sql<number>`SUM(${actorStats.hemicycleInterventions})`,
				commissionPresences: sql<number>`SUM(${actorStats.commissionPresences})`
			})
			.from(actors)
			.leftJoin(actorStats, and(eq(actorStats.actorId, actors.id), periodFilter))
			.where(inArray(actors.id, memberIds))
			.groupBy(actors.id, actors.fullName, actors.lastName, actors.photoUrl)
			.orderBy(desc(sql`SUM(${actorStats.hemicycleInterventions})`))
			.limit(10);

		return topMembers;
	};

	return {
		group,
		filters: {
			renouvellement
		},
		members: loadMembers(),
		groupStats: loadGroupStats(),
		topMembers: loadTopMembers()
	};
};
