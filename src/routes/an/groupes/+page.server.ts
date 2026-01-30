import type { PageServerLoad } from './$types';
import { db, organs } from '$lib/server/db';
import { eq, and, type SQL } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const legislature = locals.periods.an;

	// Build conditions
	const conditions: SQL[] = [eq(organs.type, 'GP')];

	if (legislature && legislature !== 'all') {
		conditions.push(eq(organs.legislature, legislature));
	}

	const groups = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			color: organs.color,
			legislature: organs.legislature
		})
		.from(organs)
		.where(and(...conditions))
		.orderBy(organs.name);

	return {
		groups,
		filters: {
			legislature: legislature
		}
	};
};
