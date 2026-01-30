import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, actors, mandates, organs } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	// Get actor
	const [actor] = await db.select().from(actors).where(eq(actors.id, id)).limit(1);

	if (!actor) {
		throw error(404, { message: 'Actor not found' });
	}

	// Get actor's mandates with organ info
	const actorMandates = await db
		.select({
			mandate: mandates,
			organ: {
				id: organs.id,
				name: organs.name,
				shortName: organs.shortName,
				type: organs.type,
				color: organs.color
			}
		})
		.from(mandates)
		.leftJoin(organs, eq(mandates.organId, organs.id))
		.where(eq(mandates.actorId, id))
		.orderBy(mandates.startDate);

	return json({
		data: {
			...actor,
			mandates: actorMandates.map((m) => ({
				...m.mandate,
				organ: m.organ
			}))
		}
	});
};
