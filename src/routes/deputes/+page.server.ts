import type { PageServerLoad } from './$types';
import { db, actors, mandates, organs } from '$lib/server/db';
import { count, ilike, or, asc, desc, eq, sql, and, inArray, type SQL } from 'drizzle-orm';
import { parsePeriodFilters } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 24;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const sort = url.searchParams.get('sort') || 'lastName';
	const order = url.searchParams.get('order') || 'asc';
	const periodFilters = parsePeriodFilters(url);

	// Build base conditions
	const conditions: SQL[] = [];

	if (search) {
		conditions.push(or(ilike(actors.fullName, `%${search}%`), ilike(actors.lastName, `%${search}%`))!);
	}

	// If legislature filter, only show deputies with mandate in that legislature
	let actorIdsInLegislature: string[] | null = null;
	if (periodFilters.legislature) {
		const mandatesInLeg = await db
			.selectDistinct({ actorId: mandates.actorId })
			.from(mandates)
			.where(eq(mandates.legislature, periodFilters.legislature));
		actorIdsInLegislature = mandatesInLeg.map((m) => m.actorId);

		if (actorIdsInLegislature.length > 0) {
			conditions.push(inArray(actors.id, actorIdsInLegislature));
		} else {
			// No deputies in this legislature
			return {
				deputies: [],
				pagination: { page, limit, total: 0, totalPages: 0 },
				filters: { search, sort, order, legislature: periodFilters.legislature }
			};
		}
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(actors).where(whereClause);

	// Get sort column
	const sortColumn = sort === 'firstName' ? actors.firstName : actors.lastName;
	const orderBy = order === 'desc' ? desc(sortColumn) : asc(sortColumn);

	// Get deputies
	const deputiesRaw = await db
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

	// Get group for these deputies (from mandates - GP = groupe parlementaire)
	const deputyIds = deputiesRaw.map(d => d.id);
	const groupsData = deputyIds.length > 0 ? await db
		.select({
			actorId: mandates.actorId,
			groupId: organs.id,
			groupShortName: organs.shortName,
			groupColor: organs.color
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(sql`${mandates.actorId} IN ${deputyIds} AND ${organs.type} = 'GP'`)
		: [];

	// Build lookup map
	const groupByActor = new Map<string, { id: string; shortName: string | null; color: string | null }>();
	for (const g of groupsData) {
		if (!groupByActor.has(g.actorId) && g.groupId) {
			groupByActor.set(g.actorId, { id: g.groupId, shortName: g.groupShortName, color: g.groupColor });
		}
	}

	const deputies = deputiesRaw.map(d => ({
		...d,
		group: groupByActor.get(d.id) || null
	}));

	return {
		deputies,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			search,
			sort,
			order,
			legislature: periodFilters.legislature
		}
	};
};
