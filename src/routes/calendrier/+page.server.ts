import { db, scrutins } from '$lib/server/db';
import { gte, lte, and, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') ?? String(now.getFullYear()));
	const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1));

	const firstDay = new Date(year, month - 1, 1);
	const lastDay = new Date(year, month, 0);
	const fmt = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

	const rows = await db
		.select({
			id: scrutins.id,
			number: scrutins.number,
			legislature: scrutins.legislature,
			title: scrutins.title,
			titleSimple: scrutins.titleSimple,
			date: scrutins.date,
			result: scrutins.result,
			totalVoters: scrutins.totalVoters,
			totalFor: scrutins.totalFor,
			totalAgainst: scrutins.totalAgainst,
			totalAbstention: scrutins.totalAbstention
		})
		.from(scrutins)
		.where(and(gte(scrutins.date, fmt(firstDay)), lte(scrutins.date, fmt(lastDay))))
		.orderBy(asc(scrutins.date), asc(scrutins.number));

	const scrutinsByDate: Record<string, typeof rows> = {};
	for (const s of rows) {
		const key = typeof s.date === 'string' ? s.date : fmt(s.date as Date);
		(scrutinsByDate[key] ??= []).push(s);
	}

	return { year, month, scrutinsByDate };
};
