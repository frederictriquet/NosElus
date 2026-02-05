import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, organs } from '$lib/server/db';
import { eq, ilike, and, count, asc, desc } from 'drizzle-orm';
import {
	parsePagination,
	paginatedResponse,
	parseFilters,
	parseSort
} from '$lib/server/api/helpers';

export const GET: RequestHandler = async ({ url }) => {
	const pagination = parsePagination(url);
	const filters = parseFilters(url, ['chamber', 'type', 'legislature', 'search']);
	const sort = parseSort(url, ['name', 'shortName', 'type', 'createdAt'], 'name');

	// Build where conditions
	const conditions = [];

	if (filters.chamber) {
		conditions.push(eq(organs.chamber, filters.chamber));
	}

	if (filters.type) {
		conditions.push(eq(organs.type, filters.type));
	}

	if (filters.legislature) {
		conditions.push(eq(organs.legislature, filters.legislature));
	}

	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(ilike(organs.name, searchTerm));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(organs).where(whereClause);

	// Determine sort column
	const sortColumn =
		sort.field === 'shortName'
			? organs.shortName
			: sort.field === 'type'
				? organs.type
				: sort.field === 'createdAt'
					? organs.createdAt
					: organs.name;

	const orderBy = sort.order === 'desc' ? desc(sortColumn) : asc(sortColumn);

	// Get paginated data
	const data = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			type: organs.type,
			chamber: organs.chamber,
			legislature: organs.legislature,
			color: organs.color,
			startDate: organs.startDate,
			endDate: organs.endDate
		})
		.from(organs)
		.where(whereClause)
		.orderBy(orderBy)
		.limit(pagination.limit)
		.offset(pagination.offset);

	return json(paginatedResponse(data, total, pagination));
};
