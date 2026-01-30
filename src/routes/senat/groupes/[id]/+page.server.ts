import type { PageServerLoad } from './$types';
import { db, organs, actors, mandates } from '$lib/server/db';
import { eq, and, sql, gte, isNull, or } from 'drizzle-orm';
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

	// Today's date for checking current mandates
	const today = new Date().toISOString().split('T')[0];

	// Loader for group members
	const loadMembers = async () => {
		// Filter by renouvellement if specified
		if (renouvellementDates && renouvellement && renouvellement !== 'all') {
			const { start, end } = renouvellementDates;

			const members = await db
				.selectDistinct({
					id: actors.id,
					name: actors.fullName,
					lastName: actors.lastName,
					photoUrl: actors.photoUrl
				})
				.from(actors)
				.innerJoin(mandates, eq(mandates.actorId, actors.id))
				.where(and(
					eq(mandates.organId, group.id),
					eq(actors.chamber, 'SENAT'),
					end ? sql`${mandates.startDate} <= ${end}` : sql`1=1`,
					sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`
				))
				.orderBy(actors.lastName);

			return members;
		} else {
			// By default, show currently active members
			const members = await db
				.selectDistinct({
					id: actors.id,
					name: actors.fullName,
					lastName: actors.lastName,
					photoUrl: actors.photoUrl
				})
				.from(actors)
				.innerJoin(mandates, eq(mandates.actorId, actors.id))
				.where(and(
					eq(mandates.organId, group.id),
					eq(actors.chamber, 'SENAT'),
					or(isNull(mandates.endDate), gte(mandates.endDate, today))
				))
				.orderBy(actors.lastName);

			return members;
		}
	};

	return {
		group,
		filters: {
			renouvellement
		},
		members: loadMembers()
	};
};
