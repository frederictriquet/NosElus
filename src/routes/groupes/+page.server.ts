import type { PageServerLoad } from './$types';
import { db, organs } from '$lib/server/db';
import { eq, and, type SQL } from 'drizzle-orm';
import { parsePeriodFilters } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ url }) => {
	const periodFilters = parsePeriodFilters(url);

	// Build conditions
	const conditions: SQL[] = [eq(organs.type, 'GP')];

	if (periodFilters.legislature) {
		conditions.push(eq(organs.legislature, periodFilters.legislature));
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
			legislature: periodFilters.legislature
		}
	};
};
