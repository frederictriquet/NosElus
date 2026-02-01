import type { PageServerLoad } from './$types';
import { db, actors, organs, scrutins, mandates } from '$lib/server/db';
import { ilike, or, eq, sql, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const limit = 20;

	if (!query || query.length < 2) {
		return {
			query,
			results: null
		};
	}

	const searchTerm = `%${query}%`;

	// Search all actors (deputies, senators, MEPs)
	const actorsResults = await db
		.select({
			id: actors.id,
			fullName: actors.fullName,
			firstName: actors.firstName,
			lastName: actors.lastName,
			chamber: actors.chamber,
			photoUrl: actors.photoUrl,
			profession: actors.profession
		})
		.from(actors)
		.where(or(ilike(actors.fullName, searchTerm), ilike(actors.lastName, searchTerm)))
		.limit(limit);

	// Get groups for found actors
	// Order by startDate DESC to get most recent mandate first
	const actorIds = actorsResults.map((a) => a.id);
	const groupsData =
		actorIds.length > 0
			? await db
					.select({
						actorId: mandates.actorId,
						groupId: organs.id,
						groupName: organs.name,
						groupShortName: organs.shortName,
						groupColor: organs.color,
						startDate: mandates.startDate
					})
					.from(mandates)
					.innerJoin(organs, eq(mandates.organId, organs.id))
					.where(sql`${mandates.actorId} IN ${actorIds} AND ${organs.type} = 'GP'`)
					.orderBy(desc(mandates.startDate))
			: [];

	// Build lookup map - first entry for each actor wins (most recent due to ordering)
	const groupByActor = new Map<
		string,
		{ id: string; name: string | null; shortName: string | null; color: string | null }
	>();
	for (const g of groupsData) {
		if (!groupByActor.has(g.actorId) && g.groupId) {
			groupByActor.set(g.actorId, {
				id: g.groupId,
				name: g.groupName,
				shortName: g.groupShortName,
				color: g.groupColor
			});
		}
	}

	// Enrich actors with groups
	const actorsWithGroups = actorsResults.map((a) => ({
		...a,
		group: groupByActor.get(a.id) || null
	}));

	// Search groups
	const groupsResults = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			type: organs.type,
			chamber: organs.chamber,
			color: organs.color
		})
		.from(organs)
		.where(
			sql`${organs.type} = 'GP' AND (${ilike(organs.name, searchTerm)} OR ${ilike(organs.shortName, searchTerm)})`
		)
		.limit(limit);

	// Search scrutins
	const scrutinsResults = await db
		.select({
			id: scrutins.id,
			title: scrutins.title,
			date: scrutins.date,
			number: scrutins.number,
			legislature: scrutins.legislature,
			result: scrutins.result
		})
		.from(scrutins)
		.where(ilike(scrutins.title, searchTerm))
		.orderBy(sql`${scrutins.date} DESC`)
		.limit(limit);

	return {
		query,
		results: {
			actors: actorsWithGroups,
			groups: groupsResults,
			scrutins: scrutinsResults,
			total: actorsWithGroups.length + groupsResults.length + scrutinsResults.length
		}
	};
};
