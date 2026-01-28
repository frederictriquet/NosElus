import type { PageServerLoad } from './$types';
import { db, scrutins } from '$lib/server/db';
import { count, ilike, eq, desc, asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 20;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const result = url.searchParams.get('result') || '';

	// Build where conditions
	const conditions = [];

	if (search) {
		conditions.push(ilike(scrutins.title, `%${search}%`));
	}

	if (result) {
		conditions.push(eq(scrutins.result, result));
	}

	const whereClause = conditions.length > 0 ? conditions[0] : undefined;

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
			result
		}
	};
};
