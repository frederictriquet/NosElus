import { error } from '@sveltejs/kit';
import { db, organs, mandates, actors, scrutins } from '$lib/server/db';
import { eq, and, sql, notLike, inArray, count, desc, type SQL } from 'drizzle-orm';
import { getCategoryLabel, type ScrutinCategory } from '$lib/server/etl/classify';

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

// ===== Sénat Helpers =====

export interface PeriodDates {
	start: string;
	end: string | null;
}

/**
 * Construit les conditions SQL pour filtrer les mandats qui chevauchent une période.
 * Un mandat chevauche une période si : startDate <= period.end ET (endDate IS NULL OR endDate >= period.start)
 */
export function buildMandateOverlapConditions(
	periodDates: PeriodDates | null
): SQL[] {
	if (!periodDates) return [];

	const { start, end } = periodDates;
	const conditions: SQL[] = [];

	if (end) {
		conditions.push(sql`${mandates.startDate} <= ${end}`);
	}
	conditions.push(sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`);

	return conditions;
}

/**
 * Construit les conditions pour les mandats actifs (sans date de fin ou date de fin future)
 */
export function buildActiveMandateConditions(referenceDate: string): SQL[] {
	return [sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${referenceDate})`];
}

/**
 * Récupère les groupes du Sénat avec leur nombre de membres
 * pour une période de renouvellement donnée.
 *
 * @param periodDates - Dates de la période (null = mandats actifs aujourd'hui)
 */
export async function getSenatGroupsWithMemberCount(
	periodDates: PeriodDates | null
): Promise<GroupWithMemberCount[]> {
	const today = new Date().toISOString().split('T')[0];

	// Build conditions for active group memberships
	const mandateConditions: SQL[] = [
		eq(organs.type, 'GP'),
		eq(organs.chamber, 'SENAT'),
		eq(actors.chamber, 'SENAT')
	];

	if (periodDates) {
		mandateConditions.push(...buildMandateOverlapConditions(periodDates));
	} else {
		// By default, show groups with currently active members
		mandateConditions.push(...buildActiveMandateConditions(today));
	}

	// Get groups with member count
	const groupsWithMembers = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			color: organs.color,
			legislature: sql<string | null>`NULL`,
			memberCount: count(sql`DISTINCT ${actors.id}`)
		})
		.from(organs)
		.innerJoin(mandates, eq(mandates.organId, organs.id))
		.innerJoin(actors, eq(mandates.actorId, actors.id))
		.where(and(...mandateConditions))
		.groupBy(organs.id, organs.name, organs.shortName, organs.color);

	return groupsWithMembers
		.map(g => ({ ...g, memberCount: Number(g.memberCount) }))
		.sort((a, b) => b.memberCount - a.memberCount);
}

/**
 * Récupère les IDs des membres d'un groupe Sénat pour une période donnée.
 */
export async function getSenatGroupMemberIds(
	groupId: string,
	periodDates: PeriodDates | null
): Promise<string[]> {
	const memberConditions: SQL[] = [
		eq(mandates.organId, groupId),
		eq(actors.chamber, 'SENAT')
	];

	if (periodDates) {
		memberConditions.push(...buildMandateOverlapConditions(periodDates));
	}

	const memberIds = await db
		.selectDistinct({ id: actors.id })
		.from(actors)
		.innerJoin(mandates, eq(mandates.actorId, actors.id))
		.where(and(...memberConditions));

	return memberIds.map(m => m.id);
}

/**
 * Convertit une période en liste d'années (pour filtrer actorStats.period)
 */
export function getYearsInPeriod(start: string, end: string | null): string[] {
	const startYear = parseInt(start.slice(0, 4));
	const endYear = end ? parseInt(end.slice(0, 4)) : new Date().getFullYear();
	const years: string[] = [];
	for (let y = startYear; y <= endYear; y++) {
		years.push(String(y));
	}
	return years;
}

// ===== Parlement Européen Helpers =====

/**
 * Construit les conditions SQL pour filtrer les mandats PE par terme.
 * Inclut le filtre sur legislature + les dates de chevauchement.
 */
export function buildPEMandateConditions(
	terme: string | null,
	periodDates: PeriodDates | null
): SQL[] {
	if (!terme || terme === 'all' || !periodDates) return [];

	const { start, end } = periodDates;
	const conditions: SQL[] = [eq(mandates.legislature, terme)];

	if (end) {
		conditions.push(sql`${mandates.startDate} <= ${end}`);
	}
	conditions.push(sql`(${mandates.endDate} IS NULL OR ${mandates.endDate} >= ${start})`);

	return conditions;
}

/**
 * Récupère les groupes PE avec leur nombre de membres pour un terme donné.
 *
 * @param terme - Numéro du terme (ex: "10") ou null pour tous
 * @param periodDates - Dates du terme pour filtrer les mandats actifs
 */
export async function getPEGroupsWithMemberCount(
	terme: string | null,
	periodDates: PeriodDates | null
): Promise<GroupWithMemberCount[]> {
	// Build conditions for active group memberships
	const mandateConditions: SQL[] = [
		eq(organs.type, 'GP'),
		eq(organs.chamber, 'PE'),
		eq(actors.chamber, 'PE')
	];

	if (terme && terme !== 'all' && periodDates) {
		mandateConditions.push(...buildPEMandateConditions(terme, periodDates));
	}

	// Get groups with member count
	const groupsWithMembers = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			color: organs.color,
			legislature: sql<string | null>`NULL`,
			memberCount: count(sql`DISTINCT ${actors.id}`)
		})
		.from(organs)
		.innerJoin(mandates, eq(mandates.organId, organs.id))
		.innerJoin(actors, eq(mandates.actorId, actors.id))
		.where(and(...mandateConditions))
		.groupBy(organs.id, organs.name, organs.shortName, organs.color);

	return groupsWithMembers
		.map(g => ({ ...g, memberCount: Number(g.memberCount) }))
		.sort((a, b) => b.memberCount - a.memberCount);
}

/**
 * Récupère les IDs des membres d'un groupe PE pour un terme donné.
 */
export async function getPEGroupMemberIds(
	groupId: string,
	terme: string | null,
	periodDates: PeriodDates | null
): Promise<string[]> {
	const memberConditions: SQL[] = [
		eq(mandates.organId, groupId),
		eq(actors.chamber, 'PE')
	];

	if (terme && terme !== 'all' && periodDates) {
		memberConditions.push(...buildPEMandateConditions(terme, periodDates));
	}

	const memberIds = await db
		.selectDistinct({ id: actors.id })
		.from(actors)
		.innerJoin(mandates, eq(mandates.actorId, actors.id))
		.where(and(...memberConditions));

	return memberIds.map(m => m.id);
}

// ===== Scrutins Helpers =====

/**
 * Interface pour les catégories de scrutins avec compteurs.
 */
export interface ScrutinCategoryWithCount {
	/** Valeur de la catégorie (ex: 'vote-final', 'amendement') */
	category: string;
	/** Nombre de scrutins dans cette catégorie */
	count: number;
	/** Label traduit en français pour l'affichage UI */
	label: string;
}

/**
 * Récupère dynamiquement les catégories de scrutins avec compteurs.
 *
 * IMPORTANT : Cette fonction respecte la règle "no-hardcoding" en récupérant
 * toujours les catégories via SELECT DISTINCT depuis la base de données.
 *
 * @param whereClause - Conditions de filtrage optionnelles (ex: legislature, dates)
 * @returns Liste des catégories avec compteurs, triées par count desc
 *
 * @example
 * ```typescript
 * // Sans filtre (toutes les catégories)
 * const categories = await getScrutinCategories();
 *
 * // Avec filtre sur legislature
 * const categories = await getScrutinCategories(eq(scrutins.legislature, '17'));
 * ```
 */
export async function getScrutinCategories(
	whereClause?: SQL
): Promise<ScrutinCategoryWithCount[]> {
	const result = await db
		.select({
			category: scrutins.category,
			count: count()
		})
		.from(scrutins)
		.where(whereClause)
		.groupBy(scrutins.category)
		.orderBy(desc(count()));

	// Filtrer les catégories null et ajouter les labels traduits
	return result
		.filter((r) => r.category !== null)
		.map((r) => ({
			category: r.category!,
			count: Number(r.count),
			label: getCategoryLabel(r.category as ScrutinCategory)
		}));
}
