import type { PageServerLoad } from './$types';
import { db, organs, mandates, actors } from '$lib/server/db';
import { eq, and, sql, isNull, or, gte, inArray, count } from 'drizzle-orm';
import { getRenouvellementDates } from '$lib/server/periods/senat-renouvellements';

export const load: PageServerLoad = async ({ locals }) => {
	const renouvellement = locals.periods.senat;

	// Get renouvellement dates for filtering
	const renouvellementDates =
		renouvellement && renouvellement !== 'all' ? await getRenouvellementDates(renouvellement) : null;

	// Today's date for checking current mandates
	const today = new Date().toISOString().split('T')[0];

	// Build conditions for active group memberships
	const mandateConditions = [
		eq(organs.type, 'GP'),
		eq(organs.chamber, 'SENAT'),
		eq(actors.chamber, 'SENAT')
	];

	if (renouvellementDates && renouvellement && renouvellement !== 'all') {
		const { start, end } = renouvellementDates;
		if (end) {
			mandateConditions.push(sql`${mandates.startDate} <= ${end}`);
		}
		mandateConditions.push(
			sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`
		);
	} else {
		// By default, show groups with currently active members
		mandateConditions.push(
			sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${today})`
		);
	}

	// Get groups with member count
	const groupsWithMembers = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			color: organs.color,
			memberCount: count(sql`DISTINCT ${actors.id}`)
		})
		.from(organs)
		.innerJoin(mandates, eq(mandates.organId, organs.id))
		.innerJoin(actors, eq(mandates.actorId, actors.id))
		.where(and(...mandateConditions))
		.groupBy(organs.id, organs.name, organs.shortName, organs.color)
		.orderBy(organs.name);

	return {
		groups: groupsWithMembers,
		filters: {
			renouvellement
		}
	};
};
