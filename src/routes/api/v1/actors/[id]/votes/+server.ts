import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, actors, votes, scrutins } from '$lib/server/db';
import { eq, count, desc, and } from 'drizzle-orm';
import { parsePagination, paginatedResponse, parseFilters } from '$lib/server/api/helpers';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const pagination = parsePagination(url);
	const filters = parseFilters(url, ['position']);

	// Check actor exists
	const [actor] = await db.select({ id: actors.id }).from(actors).where(eq(actors.id, id)).limit(1);

	if (!actor) {
		throw error(404, { message: 'Actor not found' });
	}

	// Build where conditions
	const conditions = [eq(votes.actorId, id)];

	if (filters.position) {
		conditions.push(eq(votes.position, filters.position));
	}

	const whereClause = and(...conditions);

	// Get total count
	const [{ value: total }] = await db
		.select({ value: count() })
		.from(votes)
		.where(whereClause);

	// Get paginated votes with scrutin info
	const actorVotes = await db
		.select({
			vote: {
				id: votes.id,
				position: votes.position,
				delegation: votes.delegation
			},
			scrutin: {
				id: scrutins.id,
				number: scrutins.number,
				title: scrutins.title,
				date: scrutins.date,
				type: scrutins.type,
				result: scrutins.result
			}
		})
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.where(whereClause)
		.orderBy(desc(scrutins.date))
		.limit(pagination.limit)
		.offset(pagination.offset);

	return json(
		paginatedResponse(
			actorVotes.map((v) => ({
				...v.vote,
				scrutin: v.scrutin
			})),
			total,
			pagination
		)
	);
};
