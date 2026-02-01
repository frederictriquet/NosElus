import type { PageServerLoad } from './$types';
import { db, scrutins } from '$lib/server/db';
import { count, ilike, eq, desc, and, gte, lte, type SQL } from 'drizzle-orm';
import { getScrutinCategories } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 20;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const result = url.searchParams.get('result') || '';
	const category = url.searchParams.get('category') || '';
	const legislature = locals.periods.an;
	const dateFrom = url.searchParams.get('dateFrom') || null;
	const dateTo = url.searchParams.get('dateTo') || null;

	// Build where conditions
	const conditions: SQL[] = [];

	if (search) {
		conditions.push(ilike(scrutins.title, `%${search}%`));
	}

	if (result) {
		conditions.push(eq(scrutins.result, result));
	}

	if (category) {
		conditions.push(eq(scrutins.category, category));
	}

	if (legislature && legislature !== 'all') {
		conditions.push(eq(scrutins.legislature, legislature));
	}

	if (dateFrom) {
		conditions.push(gte(scrutins.date, dateFrom));
	}

	if (dateTo) {
		conditions.push(lte(scrutins.date, dateTo));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get categories for filter dropdown (dynamique, pas hardcodé!)
	const legislatureCondition =
		legislature && legislature !== 'all' ? eq(scrutins.legislature, legislature) : undefined;
	const categories = await getScrutinCategories(legislatureCondition);

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
			category: scrutins.category,
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
		categories,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			search,
			result,
			category,
			legislature: legislature,
			dateFrom: dateFrom,
			dateTo: dateTo
		}
	};
};
