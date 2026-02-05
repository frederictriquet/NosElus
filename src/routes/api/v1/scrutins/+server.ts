import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, scrutins } from '$lib/server/db';
import { eq, ilike, and, gte, lte, count, asc, desc } from 'drizzle-orm';
import {
	parsePagination,
	paginatedResponse,
	parseFilters,
	parseSort
} from '$lib/server/api/helpers';

export const GET: RequestHandler = async ({ url }) => {
	const pagination = parsePagination(url);
	const filters = parseFilters(url, ['legislature', 'type', 'result', 'search', 'from', 'to']);
	const sort = parseSort(url, ['date', 'number', 'title', 'totalVoters'], 'date', 'desc');

	// Build where conditions
	const conditions = [];

	if (filters.legislature) {
		conditions.push(eq(scrutins.legislature, filters.legislature));
	}

	if (filters.type) {
		conditions.push(eq(scrutins.type, filters.type));
	}

	if (filters.result) {
		conditions.push(eq(scrutins.result, filters.result));
	}

	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(ilike(scrutins.title, searchTerm));
	}

	if (filters.from) {
		conditions.push(gte(scrutins.date, filters.from));
	}

	if (filters.to) {
		conditions.push(lte(scrutins.date, filters.to));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(scrutins).where(whereClause);

	// Determine sort column
	const sortColumn =
		sort.field === 'number'
			? scrutins.number
			: sort.field === 'title'
				? scrutins.title
				: sort.field === 'totalVoters'
					? scrutins.totalVoters
					: scrutins.date;

	const orderBy = sort.order === 'desc' ? desc(sortColumn) : asc(sortColumn);

	// Get paginated data
	const data = await db
		.select({
			id: scrutins.id,
			number: scrutins.number,
			title: scrutins.title,
			date: scrutins.date,
			type: scrutins.type,
			result: scrutins.result,
			legislature: scrutins.legislature,
			totalVoters: scrutins.totalVoters,
			totalFor: scrutins.totalFor,
			totalAgainst: scrutins.totalAgainst,
			totalAbstention: scrutins.totalAbstention
		})
		.from(scrutins)
		.where(whereClause)
		.orderBy(orderBy)
		.limit(pagination.limit)
		.offset(pagination.offset);

	return json(paginatedResponse(data, total, pagination));
};
