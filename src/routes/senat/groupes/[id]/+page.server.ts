import type { PageServerLoad } from './$types';
import { db, organs, actors, mandates, actorStats } from '$lib/server/db';
import { eq, and, sql, inArray, desc, type SQL } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getRenouvellementDates } from '$lib/server/periods/senat-renouvellements';

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
	const renouvellementDates =
		renouvellement && renouvellement !== 'all' ? await getRenouvellementDates(renouvellement) : null;

	// Loader for group members
	const loadMembers = async () => {
		const memberConditions: SQL[] = [
			eq(mandates.organId, group.id),
			eq(actors.chamber, 'SENAT')
		];

		// Filter by renouvellement if specified
		if (renouvellementDates && renouvellement && renouvellement !== 'all') {
			const { start, end } = renouvellementDates;
			if (end) {
				memberConditions.push(sql`${mandates.startDate} <= ${end}`);
			}
			memberConditions.push(sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`);
		}
		// For 'all', no date filter - show all members who have ever been in this group

		const members = await db
			.selectDistinct({
				id: actors.id,
				name: actors.fullName,
				lastName: actors.lastName,
				photoUrl: actors.photoUrl
			})
			.from(actors)
			.innerJoin(mandates, eq(mandates.actorId, actors.id))
			.where(and(...memberConditions))
			.orderBy(actors.lastName);

		return members;
	};

	// Get years covered by a renouvellement period
	const getYearsInPeriod = (start: string, end: string | null): string[] => {
		const startYear = parseInt(start.slice(0, 4));
		const endYear = end ? parseInt(end.slice(0, 4)) : new Date().getFullYear();
		const years: string[] = [];
		for (let y = startYear; y <= endYear; y++) {
			years.push(String(y));
		}
		return years;
	};

	// Loader for aggregated activity stats of group members
	const loadGroupStats = async () => {
		// First get member IDs for this group
		const memberConditions: SQL[] = [
			eq(mandates.organId, group.id),
			eq(actors.chamber, 'SENAT')
		];

		if (renouvellementDates && renouvellement && renouvellement !== 'all') {
			const { start, end } = renouvellementDates;
			if (end) {
				memberConditions.push(sql`${mandates.startDate} <= ${end}`);
			}
			memberConditions.push(sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`);
		}
		// For 'all', no date filter - include all members

		const memberIds = await db
			.selectDistinct({ id: actors.id })
			.from(actors)
			.innerJoin(mandates, eq(mandates.actorId, actors.id))
			.where(and(...memberConditions));

		if (memberIds.length === 0) {
			return null;
		}

		const ids = memberIds.map(m => m.id);

		// Build stats conditions
		const statsConditions: SQL[] = [inArray(actorStats.actorId, ids)];

		if (renouvellementDates && renouvellement && renouvellement !== 'all') {
			// Filter by years in the renouvellement period
			const years = getYearsInPeriod(renouvellementDates.start, renouvellementDates.end);
			statsConditions.push(inArray(actorStats.period, years));
		} else {
			// Use 'all' period for total stats
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
		// Build period filter for stats
		let periodFilter: SQL;
		if (renouvellementDates && renouvellement && renouvellement !== 'all') {
			const years = getYearsInPeriod(renouvellementDates.start, renouvellementDates.end);
			periodFilter = inArray(actorStats.period, years);
		} else {
			periodFilter = eq(actorStats.period, 'all');
		}

		// Get member IDs first (filtered by mandate period)
		const memberConditions: SQL[] = [
			eq(mandates.organId, group.id),
			eq(actors.chamber, 'SENAT')
		];

		if (renouvellementDates && renouvellement && renouvellement !== 'all') {
			const { start, end } = renouvellementDates;
			if (end) {
				memberConditions.push(sql`${mandates.startDate} <= ${end}`);
			}
			memberConditions.push(sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`);
		}
		// For 'all', no date filter - include all members

		const memberIds = await db
			.selectDistinct({ id: actors.id })
			.from(actors)
			.innerJoin(mandates, eq(mandates.actorId, actors.id))
			.where(and(...memberConditions));

		if (memberIds.length === 0) {
			return [];
		}

		const ids = memberIds.map(m => m.id);

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
			.leftJoin(actorStats, and(
				eq(actorStats.actorId, actors.id),
				periodFilter
			))
			.where(inArray(actors.id, ids))
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
