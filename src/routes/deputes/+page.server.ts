import type { PageServerLoad } from './$types';
import { db, actors } from '$lib/server/db';
import { count, ilike, or, asc, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 24;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const sort = url.searchParams.get('sort') || 'lastName';
	const order = url.searchParams.get('order') || 'asc';

	// Build where clause
	const whereClause = search
		? or(ilike(actors.fullName, `%${search}%`), ilike(actors.lastName, `%${search}%`))
		: undefined;

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(actors).where(whereClause);

	// Get sort column
	const sortColumn = sort === 'firstName' ? actors.firstName : actors.lastName;
	const orderBy = order === 'desc' ? desc(sortColumn) : asc(sortColumn);

	// Get data
	const data = await db
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

	return {
		deputies: data,
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
	};
};
