import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, actors, mandates, organs } from '$lib/server/db';
import { count, ilike, or, asc, desc, eq, sql, and, like, type SQL } from 'drizzle-orm';
import { getTermDates } from '$lib/server/periods/pe-terms';

export const GET: RequestHandler = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 24;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const sort = url.searchParams.get('sort') || 'lastName';
	const order = url.searchParams.get('order') || 'asc';
	const terme = url.searchParams.get('terme');

	// Get term dates if specified
	const termDates = terme ? await getTermDates(terme) : null;

	// Build base conditions - filter by chamber PE
	const conditions: SQL[] = [eq(actors.chamber, 'PE')];

	if (search) {
		conditions.push(
			or(ilike(actors.fullName, `%${search}%`), ilike(actors.lastName, `%${search}%`))!
		);
	}

	// If term is specified, filter MEPs who had an active mandate during that period
	let filteredActorIds: string[] | null = null;
	if (termDates && terme) {
		const { start, end } = termDates;
		const activeMandates = await db
			.selectDistinct({ actorId: mandates.actorId })
			.from(mandates)
			.innerJoin(actors, eq(mandates.actorId, actors.id))
			.where(
				and(
					eq(actors.chamber, 'PE'),
					like(mandates.organId, 'GPEU-%'),
					eq(mandates.legislature, terme),
					end ? sql`${mandates.startDate} <= ${end}` : sql`1=1`,
					sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`
				)
			);
		filteredActorIds = activeMandates.map((m) => m.actorId);

		if (filteredActorIds.length === 0) {
			return json({
				meps: [],
				pagination: { page, limit, total: 0, totalPages: 0 },
				filters: { search, sort, order, terme }
			});
		}

		conditions.push(sql`${actors.id} IN ${filteredActorIds}`);
	}

	const whereClause = and(...conditions);

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(actors).where(whereClause);

	// Get sort column
	const sortColumn = sort === 'firstName' ? actors.firstName : actors.lastName;
	const orderBy = order === 'desc' ? desc(sortColumn) : asc(sortColumn);

	// Get MEPs
	const mepsRaw = await db
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

	// Get group for these MEPs (from mandates - GP = groupe parlementaire)
	const mepIds = mepsRaw.map((d) => d.id);
	const groupsData =
		mepIds.length > 0
			? await db
					.select({
						actorId: mandates.actorId,
						groupId: organs.id,
						groupName: organs.name,
						groupShortName: organs.shortName,
						groupColor: organs.color
					})
					.from(mandates)
					.innerJoin(organs, eq(mandates.organId, organs.id))
					.where(sql`${mandates.actorId} IN ${mepIds} AND ${organs.type} = 'GP'`)
			: [];

	// Build lookup map
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

	const meps = mepsRaw.map((d) => ({
		...d,
		group: groupByActor.get(d.id) || null
	}));

	return json({
		meps,
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
			terme
		}
	});
};
