import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, actors, organs, scrutins } from '$lib/server/db';
import { ilike, or } from 'drizzle-orm';
import { badRequest } from '$lib/server/api/helpers';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const type = url.searchParams.get('type'); // 'actors', 'organs', 'scrutins', or null for all
	const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));

	if (!query || query.length < 2) {
		throw badRequest('Query parameter "q" must be at least 2 characters');
	}

	const searchTerm = `%${query}%`;
	const results: {
		actors?: Array<{ id: string; fullName: string; chamber: string; photoUrl: string | null }>;
		organs?: Array<{ id: string; name: string; shortName: string | null; type: string }>;
		scrutins?: Array<{ id: string; title: string; date: string | null; number: number }>;
	} = {};

	// Search actors
	if (!type || type === 'actors') {
		results.actors = await db
			.select({
				id: actors.id,
				fullName: actors.fullName,
				chamber: actors.chamber,
				photoUrl: actors.photoUrl
			})
			.from(actors)
			.where(or(ilike(actors.fullName, searchTerm), ilike(actors.lastName, searchTerm)))
			.limit(limit);
	}

	// Search organs
	if (!type || type === 'organs') {
		results.organs = await db
			.select({
				id: organs.id,
				name: organs.name,
				shortName: organs.shortName,
				type: organs.type
			})
			.from(organs)
			.where(or(ilike(organs.name, searchTerm), ilike(organs.shortName, searchTerm)))
			.limit(limit);
	}

	// Search scrutins
	if (!type || type === 'scrutins') {
		results.scrutins = await db
			.select({
				id: scrutins.id,
				title: scrutins.title,
				date: scrutins.date,
				number: scrutins.number
			})
			.from(scrutins)
			.where(ilike(scrutins.title, searchTerm))
			.limit(limit);
	}

	return json({
		query,
		results
	});
};
