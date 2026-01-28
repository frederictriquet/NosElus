import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, actors } from '$lib/server/db';
import { eq, ilike, and, isNull, or, count, asc, desc } from 'drizzle-orm';
import {
	parsePagination,
	paginatedResponse,
	parseFilters,
	parseSort
} from '$lib/server/api/helpers';

export const GET: RequestHandler = async ({ url }) => {
	const pagination = parsePagination(url);
	const filters = parseFilters(url, ['chamber', 'search', 'active']);
	const sort = parseSort(url, ['lastName', 'firstName', 'fullName', 'createdAt'], 'lastName');

	// Build where conditions
	const conditions = [];

	if (filters.chamber) {
		conditions.push(eq(actors.chamber, filters.chamber));
	}

	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			or(ilike(actors.fullName, searchTerm), ilike(actors.lastName, searchTerm))
		);
	}

	// Active = no death date (simplified, in real app would check mandates)
	if (filters.active === 'true') {
		conditions.push(isNull(actors.deathDate));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [{ value: total }] = await db
		.select({ value: count() })
		.from(actors)
		.where(whereClause);

	// Determine sort column
	const sortColumn =
		sort.field === 'firstName'
			? actors.firstName
			: sort.field === 'fullName'
				? actors.fullName
				: sort.field === 'createdAt'
					? actors.createdAt
					: actors.lastName;

	const orderBy = sort.order === 'desc' ? desc(sortColumn) : asc(sortColumn);

	// Get paginated data
	const data = await db
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
		.where(whereClause)
		.orderBy(orderBy)
		.limit(pagination.limit)
		.offset(pagination.offset);

	return json(paginatedResponse(data, total, pagination));
};
