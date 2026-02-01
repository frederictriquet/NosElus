import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, actors, mandates, organs } from '$lib/server/db';
import { count, ilike, or, asc, desc, eq, sql, and, type SQL } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 24;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const sort = url.searchParams.get('sort') || 'lastName';
	const order = url.searchParams.get('order') || 'asc';

	// Build base conditions - filter by SENAT chamber
	const conditions: SQL[] = [eq(actors.chamber, 'SENAT')];

	if (search) {
		conditions.push(or(ilike(actors.fullName, `%${search}%`), ilike(actors.lastName, `%${search}%`))!);
	}

	const whereClause = and(...conditions);

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(actors).where(whereClause);

	// Get sort column
	const sortColumn = sort === 'firstName' ? actors.firstName : actors.lastName;
	const orderBy = order === 'desc' ? desc(sortColumn) : asc(sortColumn);

	// Get senators
	const senatorsRaw = await db
		.select({
			id: actors.id,
			fullName: actors.fullName,
			firstName: actors.firstName,
			lastName: actors.lastName,
			photoUrl: actors.photoUrl,
			profession: actors.profession
		})
		.from(actors)
		.where(whereClause)
		.orderBy(orderBy)
		.limit(limit)
		.offset(offset);

	// Get group for these senators (from mandates - GP = groupe parlementaire)
	// Order by startDate DESC to get most recent mandate first
	const senatorIds = senatorsRaw.map(s => s.id);
	const groupsData = senatorIds.length > 0 ? await db
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
		.where(sql`${mandates.actorId} IN ${senatorIds} AND ${organs.type} = 'GP' AND ${organs.chamber} = 'SENAT'`)
		.orderBy(desc(mandates.startDate))
		: [];

	// Build lookup map - first entry for each actor wins (most recent due to ordering)
	const groupByActor = new Map<string, { id: string; name: string | null; shortName: string | null; color: string | null }>();
	for (const g of groupsData) {
		if (!groupByActor.has(g.actorId) && g.groupId) {
			groupByActor.set(g.actorId, { id: g.groupId, name: g.groupName, shortName: g.groupShortName, color: g.groupColor });
		}
	}

	const senators = senatorsRaw.map(s => ({
		...s,
		group: groupByActor.get(s.id) || null
	}));

	return json({
		senators,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			search,
			sort,
			order
		}
	});
};
