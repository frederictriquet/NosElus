import { error } from '@sveltejs/kit';

// ===== Period Filters =====

export interface PeriodFilters {
	legislature: string | null;
	dateFrom: string | null;
	dateTo: string | null;
}

export const LEGISLATURE_DATES: Record<string, { start: string; end: string | null }> = {
	'17': { start: '2024-07-18', end: null },
	'16': { start: '2022-06-28', end: '2024-06-09' },
	'15': { start: '2017-06-27', end: '2022-06-21' },
	'14': { start: '2012-06-20', end: '2017-06-20' },
	'13': { start: '2007-06-20', end: '2012-06-19' },
	'12': { start: '2002-06-25', end: '2007-06-19' }
};

export function parsePeriodFilters(url: URL): PeriodFilters {
	const legislature = url.searchParams.get('legislature') || null;
	const dateFrom = url.searchParams.get('dateFrom') || null;
	const dateTo = url.searchParams.get('dateTo') || null;

	// Validate legislature if provided
	const validLegislature = legislature && LEGISLATURE_DATES[legislature] ? legislature : null;

	// Validate dates (basic ISO format check)
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	const validDateFrom = dateFrom && dateRegex.test(dateFrom) ? dateFrom : null;
	const validDateTo = dateTo && dateRegex.test(dateTo) ? dateTo : null;

	return {
		legislature: validLegislature,
		dateFrom: validDateFrom,
		dateTo: validDateTo
	};
}

// ===== Pagination =====

export interface PaginationParams {
	page: number;
	limit: number;
	offset: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrevious: boolean;
	};
}

export function parsePagination(url: URL): PaginationParams {
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
	const offset = (page - 1) * limit;

	return { page, limit, offset };
}

export function paginatedResponse<T>(
	data: T[],
	total: number,
	pagination: PaginationParams
): PaginatedResponse<T> {
	const totalPages = Math.ceil(total / pagination.limit);

	return {
		data,
		pagination: {
			page: pagination.page,
			limit: pagination.limit,
			total,
			totalPages,
			hasNext: pagination.page < totalPages,
			hasPrevious: pagination.page > 1
		}
	};
}

export function notFound(message = 'Resource not found') {
	return error(404, { message });
}

export function badRequest(message = 'Bad request') {
	return error(400, { message });
}

export function serverError(message = 'Internal server error') {
	return error(500, { message });
}

export function parseFilters(url: URL, allowedFilters: string[]): Record<string, string | null> {
	const filters: Record<string, string | null> = {};

	for (const key of allowedFilters) {
		const value = url.searchParams.get(key);
		filters[key] = value || null;
	}

	return filters;
}

export function parseSort(
	url: URL,
	allowedFields: string[],
	defaultField: string,
	defaultOrder: 'asc' | 'desc' = 'asc'
): { field: string; order: 'asc' | 'desc' } {
	const sortParam = url.searchParams.get('sort') || defaultField;
	const order = url.searchParams.get('order') === 'desc' ? 'desc' : defaultOrder;

	// Validate field
	const field = allowedFields.includes(sortParam) ? sortParam : defaultField;

	return { field, order };
}
