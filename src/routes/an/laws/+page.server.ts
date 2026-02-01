import type { PageServerLoad } from './$types';
import { db, laws } from '$lib/server/db';
import { count, ilike, eq, desc, and, type SQL } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 20;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const type = url.searchParams.get('type') || '';
	const status = url.searchParams.get('status') || '';
	const legislature = locals.periods.an;

	// Build where conditions
	const conditions: SQL[] = [];

	if (search) {
		conditions.push(ilike(laws.title, `%${search}%`));
	}

	if (type) {
		conditions.push(eq(laws.type, type));
	}

	if (status) {
		conditions.push(eq(laws.status, status));
	}

	if (legislature && legislature !== 'all') {
		conditions.push(eq(laws.legislature, legislature));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get types for filter dropdown
	const types = await db
		.selectDistinct({ type: laws.type })
		.from(laws)
		.where(legislature && legislature !== 'all' ? eq(laws.legislature, legislature) : undefined)
		.orderBy(laws.type);

	// Get statuses for filter dropdown
	const statuses = await db
		.selectDistinct({ status: laws.status })
		.from(laws)
		.where(legislature && legislature !== 'all' ? eq(laws.legislature, legislature) : undefined)
		.orderBy(laws.status);

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(laws).where(whereClause);

	// Get data
	const data = await db
		.select({
			id: laws.id,
			title: laws.title,
			shortTitle: laws.shortTitle,
			type: laws.type,
			status: laws.status,
			depositDate: laws.depositDate,
			legislature: laws.legislature,
			initiator: laws.initiator,
			theme: laws.theme
		})
		.from(laws)
		.where(whereClause)
		.orderBy(desc(laws.depositDate))
		.limit(limit)
		.offset(offset);

	return {
		laws: data,
		types: types.map((t) => t.type).filter(Boolean) as string[],
		statuses: statuses.map((s) => s.status).filter(Boolean) as string[],
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			search,
			type,
			status,
			legislature
		}
	};
};
