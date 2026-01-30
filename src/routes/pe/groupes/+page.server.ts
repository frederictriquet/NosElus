import type { PageServerLoad } from './$types';
import { db, organs, mandates, actors } from '$lib/server/db';
import { eq, and, sql, count } from 'drizzle-orm';
import { getTermDates } from '$lib/server/periods/pe-terms';

export const load: PageServerLoad = async ({ locals }) => {
	const terme = locals.periods.pe;

	// Get term dates for filtering
	const termDates = terme && terme !== 'all' ? await getTermDates(terme) : null;

	// Build conditions for active group memberships
	const mandateConditions = [
		eq(organs.type, 'GP'),
		eq(organs.chamber, 'PE'),
		eq(actors.chamber, 'PE')
	];

	if (termDates && terme && terme !== 'all') {
		const { start, end } = termDates;
		// Filter by term legislature
		mandateConditions.push(eq(mandates.legislature, terme));
		if (end) {
			mandateConditions.push(sql`${mandates.startDate} <= ${end}`);
		}
		mandateConditions.push(
			sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`
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
			terme
		}
	};
};
