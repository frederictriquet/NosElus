import { error } from '@sveltejs/kit';
import { db, organs, mandates } from '$lib/server/db';
import { eq, and, sql, notLike, inArray } from 'drizzle-orm';

// ===== Period Filters =====

export interface PeriodFilters {
	legislature: string | null;
	dateFrom: string | null;
	dateTo: string | null;
}

export function parsePeriodFilters(url: URL): PeriodFilters {
	const legislature = url.searchParams.get('legislature') || null;
	const dateFrom = url.searchParams.get('dateFrom') || null;
	const dateTo = url.searchParams.get('dateTo') || null;

	// Validate legislature: must be a number between 1 and 99
	const validLegislature =
		legislature && /^\d{1,2}$/.test(legislature) ? legislature : null;

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

// ===== Vote Statistics Helpers =====

export type VotePosition = 'pour' | 'contre' | 'abstention' | 'non-votant';

export interface VoteDistribution {
	pour: number;
	contre: number;
	abstention: number;
	'non-votant': number;
}

/**
 * Convertit un tableau de {position, count} en objet VoteDistribution
 * Utilisé dans les pages de détail d'élus et de groupes
 */
export function mapVoteDistribution(
	rows: Array<{ position: string | null; count: number }>
): VoteDistribution {
	const distribution: VoteDistribution = { pour: 0, contre: 0, abstention: 0, 'non-votant': 0 };
	for (const row of rows) {
		if (row.position && row.position in distribution) {
			distribution[row.position as VotePosition] = row.count;
		}
	}
	return distribution;
}

/**
 * Détermine la position majoritaire d'un groupe à partir des données de vote
 * Gère les différents formats (pour/contre ou for/against)
 */
export function getGroupMajorityPosition(
	groupData: Record<string, unknown>
): VotePosition | null {
	if (!groupData) return null;

	// Si une position est explicitement définie
	if (typeof groupData.position === 'string') {
		return groupData.position.toLowerCase() as VotePosition;
	}

	// Calculer depuis les compteurs
	const pour = (groupData.pour ?? groupData.for ?? 0) as number;
	const contre = (groupData.contre ?? groupData.against ?? 0) as number;
	const abstention = (groupData.abstention ?? 0) as number;

	if (pour >= contre && pour >= abstention) return 'pour';
	if (contre >= pour && contre >= abstention) return 'contre';
	if (abstention > 0) return 'abstention';

	return null;
}

/**
 * Calcule le taux d'alignement d'un élu avec son groupe
 */
export function calculateAlignmentRate(
	actorVotes: Array<{
		position: string | null;
		groupId: string | null;
		groupResults: unknown;
	}>
): number | null {
	if (actorVotes.length === 0) return null;

	let aligned = 0;
	let total = 0;

	for (const vote of actorVotes) {
		if (!vote.position || vote.position === 'non-votant') continue;
		if (!vote.groupResults || !vote.groupId) continue;

		const results = vote.groupResults as Record<string, Record<string, unknown>>;
		const groupData = results[vote.groupId];
		if (!groupData) continue;

		const groupMajority = getGroupMajorityPosition(groupData);
		if (!groupMajority || groupMajority === 'non-votant') continue;

		total++;
		if (vote.position === groupMajority) {
			aligned++;
		}
	}

	return total > 0 ? Math.round((aligned / total) * 100) : null;
}

// ===== Group Distribution Helpers =====

export interface GroupWithMemberCount {
	id: string;
	name: string | null;
	shortName: string | null;
	color: string | null;
	legislature: string | null;
	memberCount: number;
}

/**
 * Récupère les groupes parlementaires AN avec leur nombre de membres actifs
 * pour une législature donnée.
 *
 * @param legislature - Numéro de législature (ex: "17")
 * @param referenceDate - Date de référence pour déterminer les mandats actifs
 *                        (aujourd'hui pour législature en cours, date de fin pour les passées)
 */
export async function getANGroupsWithMemberCount(
	legislature: string,
	referenceDate: string
): Promise<GroupWithMemberCount[]> {
	// Count distinct active members per group for this legislature
	const groupMemberCounts = await db
		.select({
			organId: mandates.organId,
			memberCount: sql<number>`count(distinct case when ${mandates.endDate} is null or ${mandates.endDate} >= ${referenceDate} then ${mandates.actorId} end)`
		})
		.from(mandates)
		.innerJoin(organs, eq(organs.id, mandates.organId))
		.where(and(
			eq(mandates.legislature, legislature),
			eq(organs.type, 'GP'),
			notLike(organs.id, 'PO_GP_%') // Exclude artificial groups
		))
		.groupBy(mandates.organId);

	const organIds = groupMemberCounts.map(g => g.organId);
	if (organIds.length === 0) return [];

	const countByOrgan = new Map(groupMemberCounts.map(c => [c.organId, Number(c.memberCount)]));

	// Get group details
	const groupDetails = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			color: organs.color,
			legislature: organs.legislature
		})
		.from(organs)
		.where(inArray(organs.id, organIds));

	// Combine and sort by member count (descending)
	return groupDetails
		.map(g => ({
			...g,
			memberCount: countByOrgan.get(g.id) || 0
		}))
		.filter(g => g.memberCount > 0)
		.sort((a, b) => b.memberCount - a.memberCount);
}
