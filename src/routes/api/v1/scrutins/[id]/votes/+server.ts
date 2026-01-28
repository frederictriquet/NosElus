import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, scrutins, votes, actors, organs } from '$lib/server/db';
import { eq, count } from 'drizzle-orm';
import { parsePagination, paginatedResponse, parseFilters } from '$lib/server/api/helpers';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const pagination = parsePagination(url);
	const filters = parseFilters(url, ['position', 'groupId']);

	// Check scrutin exists
	const [scrutin] = await db
		.select({ id: scrutins.id })
		.from(scrutins)
		.where(eq(scrutins.id, id))
		.limit(1);

	if (!scrutin) {
		throw error(404, { message: 'Scrutin not found' });
	}

	// Build where conditions
	const conditions = [eq(votes.scrutinId, id)];

	if (filters.position) {
		conditions.push(eq(votes.position, filters.position));
	}

	if (filters.groupId) {
		conditions.push(eq(votes.groupId, filters.groupId));
	}

	// Get total count
	const [{ value: total }] = await db
		.select({ value: count() })
		.from(votes)
		.where(eq(votes.scrutinId, id));

	// Get paginated votes with actor and group info
	const scrutinVotes = await db
		.select({
			vote: {
				id: votes.id,
				position: votes.position,
				delegation: votes.delegation
			},
			actor: {
				id: actors.id,
				fullName: actors.fullName,
				photoUrl: actors.photoUrl
			},
			group: {
				id: organs.id,
				name: organs.name,
				shortName: organs.shortName,
				color: organs.color
			}
		})
		.from(votes)
		.innerJoin(actors, eq(votes.actorId, actors.id))
		.leftJoin(organs, eq(votes.groupId, organs.id))
		.where(eq(votes.scrutinId, id))
		.limit(pagination.limit)
		.offset(pagination.offset);

	return json(
		paginatedResponse(
			scrutinVotes.map((v) => ({
				...v.vote,
				actor: v.actor,
				group: v.group
			})),
			total,
			pagination
		)
	);
};
