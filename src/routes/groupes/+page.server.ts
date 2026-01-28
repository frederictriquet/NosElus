import type { PageServerLoad } from './$types';
import { db, organs } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const groups = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			color: organs.color,
			legislature: organs.legislature
		})
		.from(organs)
		.where(eq(organs.type, 'GP'))
		.orderBy(organs.name);

	return { groups };
};
