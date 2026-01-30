import type { PageServerLoad } from './$types';
import { db, actors, mandates, organs } from '$lib/server/db';
import { eq, and, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Get actor
	const [actor] = await db
		.select()
		.from(actors)
		.where(and(eq(actors.id, params.id), eq(actors.chamber, 'SENAT')));

	if (!actor) {
		throw error(404, { message: 'Sénateur non trouvé' });
	}

	// Get senator's group
	const [senatorGroup] = await db
		.select({
			groupId: organs.id,
			groupName: organs.name,
			groupShortName: organs.shortName,
			groupColor: organs.color,
			constituency: mandates.constituency
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(
			sql`${mandates.actorId} = ${params.id} AND ${organs.type} = 'GP' AND ${organs.chamber} = 'SENAT'`
		)
		.limit(1);

	return {
		actor,
		group: senatorGroup || null
	};
};
