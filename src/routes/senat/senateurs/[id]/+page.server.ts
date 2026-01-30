import type { PageServerLoad } from './$types';
import { db, actors, mandates, organs } from '$lib/server/db';
import { eq, and, sql, desc } from 'drizzle-orm';
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

	// Get senator's current group (most recent GP mandate)
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
		.orderBy(desc(mandates.startDate))
		.limit(1);

	// Get all mandates for this senator
	const senatorMandates = await db
		.select({
			id: mandates.id,
			organId: mandates.organId,
			organName: organs.name,
			organShortName: organs.shortName,
			organType: organs.type,
			organColor: organs.color,
			startDate: mandates.startDate,
			endDate: mandates.endDate,
			quality: mandates.quality,
			legislature: mandates.legislature,
			constituency: mandates.constituency
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(eq(mandates.actorId, params.id))
		.orderBy(desc(mandates.startDate));

	// Get senator mandate (type 'senateur') for mandate dates
	const senatorMandate = await db
		.select({
			startDate: mandates.startDate,
			endDate: mandates.endDate,
			constituency: mandates.constituency
		})
		.from(mandates)
		.where(and(eq(mandates.actorId, params.id), eq(mandates.type, 'senateur')))
		.orderBy(desc(mandates.startDate))
		.limit(1);

	return {
		actor,
		group: senatorGroup || null,
		mandates: senatorMandates,
		senatorMandate: senatorMandate[0] || null
	};
};
