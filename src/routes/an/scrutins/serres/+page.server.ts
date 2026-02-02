import type { PageServerLoad } from './$types';
import {
	parsePeriodFilters,
	parsePagination,
	getTightScrutins,
	countTightScrutins,
	getScrutinCategories,
	TIGHT_VOTE_THRESHOLDS,
	TIGHT_THRESHOLD_LABELS,
	DEFAULT_TIGHT_THRESHOLD,
	type TightVoteThreshold
} from '$lib/server/api/helpers';
import { db, scrutins } from '$lib/server/db';
import { eq, and, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, cookies }) => {
	// Parse filters
	const periodFilters = parsePeriodFilters(url);
	const pagination = parsePagination(url);
	const category = url.searchParams.get('category') || null;

	// Parse threshold (validate against allowed values)
	const thresholdParam = url.searchParams.get('seuil');
	const parsedThreshold = thresholdParam ? parseInt(thresholdParam, 10) : DEFAULT_TIGHT_THRESHOLD;
	const threshold: TightVoteThreshold = TIGHT_VOTE_THRESHOLDS.includes(
		parsedThreshold as TightVoteThreshold
	)
		? (parsedThreshold as TightVoteThreshold)
		: DEFAULT_TIGHT_THRESHOLD;

	// Build where clause
	const conditions: ReturnType<typeof sql>[] = [];

	if (periodFilters.legislature) {
		conditions.push(eq(scrutins.legislature, periodFilters.legislature));
	}

	if (category) {
		conditions.push(eq(scrutins.category, category));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Fetch data (parallelize)
	const [tightScrutins, totalCount, categories] = await Promise.all([
		getTightScrutins(threshold, whereClause, pagination.limit, pagination.offset),
		countTightScrutins(threshold, whereClause),
		getScrutinCategories(whereClause)
	]);

	// Calculate pagination metadata
	const totalPages = Math.ceil(totalCount / pagination.limit);

	return {
		scrutins: tightScrutins,
		pagination: {
			page: pagination.page,
			limit: pagination.limit,
			total: totalCount,
			totalPages,
			hasNext: pagination.page < totalPages,
			hasPrevious: pagination.page > 1
		},
		filters: {
			threshold,
			category,
			legislature: periodFilters.legislature
		},
		categories,
		thresholds: TIGHT_VOTE_THRESHOLDS,
		thresholdLabels: TIGHT_THRESHOLD_LABELS
	};
};
