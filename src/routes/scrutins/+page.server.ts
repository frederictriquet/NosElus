import type { PageServerLoad } from './$types';
import { db, scrutins } from '$lib/server/db';
import { count, ilike, eq, desc, and, gte, lte, type SQL } from 'drizzle-orm';
import { parsePeriodFilters } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 20;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const result = url.searchParams.get('result') || '';
	const periodFilters = parsePeriodFilters(url);

	// Build where conditions
	const conditions: SQL[] = [];

	if (search) {
		conditions.push(ilike(scrutins.title, `%${search}%`));
	}

	if (result) {
		conditions.push(eq(scrutins.result, result));
	}

	if (periodFilters.legislature) {
		conditions.push(eq(scrutins.legislature, periodFilters.legislature));
	}

	if (periodFilters.dateFrom) {
		conditions.push(gte(scrutins.date, periodFilters.dateFrom));
	}

	if (periodFilters.dateTo) {
		conditions.push(lte(scrutins.date, periodFilters.dateTo));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(scrutins).where(whereClause);

	// Get data
	const data = await db
		.select({
			id: scrutins.id,
			number: scrutins.number,
			title: scrutins.title,
			date: scrutins.date,
			type: scrutins.type,
			result: scrutins.result,
			totalVoters: scrutins.totalVoters,
			totalFor: scrutins.totalFor,
			totalAgainst: scrutins.totalAgainst,
			totalAbstention: scrutins.totalAbstention
		})
		.from(scrutins)
		.where(whereClause)
		.orderBy(desc(scrutins.date), desc(scrutins.number))
		.limit(limit)
		.offset(offset);

	return {
		scrutins: data,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			search,
			result,
			legislature: periodFilters.legislature,
			dateFrom: periodFilters.dateFrom,
			dateTo: periodFilters.dateTo
		}
	};
};
