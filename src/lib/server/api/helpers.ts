import { error } from '@sveltejs/kit';
import {
	db,
	organs,
	mandates,
	actors,
	scrutins,
	votes,
	laws,
	lawCosignatories,
	searchSynonyms,
	searchNoiseWords
} from '$lib/server/db';
import { eq, and, or, sql, notLike, inArray, count, desc, asc, ilike, type SQL } from 'drizzle-orm';
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
	const validLegislature = legislature && /^\d{1,2}$/.test(legislature) ? legislature : null;

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
export function getGroupMajorityPosition(groupData: Record<string, unknown>): VotePosition | null {
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

// ===== Autonomy Stats =====

import {
	type AutonomyStats,
	type AutonomyByCategory,
	type DivisiveVote,
	CATEGORY_LABELS,
	MIN_VOTES_FOR_STATS,
	getCachedAutonomyStats,
	setCachedAutonomyStats
} from '../utils/dissidence';

/**
 * Calcule les stats d'autonomie d'un député par rapport à son groupe.
 * Autonomie = pourcentage de votes où le député diffère de la position majoritaire de son groupe.
 *
 * Utilise un cache in-memory (TTL 1h) pour optimiser les performances.
 *
 * @param actorId - ID du député
 * @param groupId - ID du groupe (optionnel, sinon déduit des votes)
 * @param filters - Filtres de période (legislature, dateFrom, dateTo)
 * @returns Stats d'autonomie ou null si pas assez de votes comparables
 */
export async function calculateAutonomyStats(
	actorId: string,
	groupId: string | null,
	filters: PeriodFilters
): Promise<AutonomyStats | null> {
	// Check cache first
	const cached = getCachedAutonomyStats(actorId, groupId, filters);
	if (cached) {
		return cached;
	}

	// Build WHERE conditions
	const conditions: SQL[] = [
		eq(votes.actorId, actorId),
		sql`${votes.groupId} IS NOT NULL`,
		sql`${scrutins.groupResults} ? ${votes.groupId}` // Group has results for this scrutin
	];

	if (groupId) {
		conditions.push(eq(votes.groupId, groupId));
	}

	if (filters.legislature && filters.legislature !== 'all') {
		conditions.push(eq(scrutins.legislature, filters.legislature));
	}

	if (filters.dateFrom) {
		conditions.push(sql`${scrutins.date} >= ${filters.dateFrom}`);
	}

	if (filters.dateTo) {
		conditions.push(sql`${scrutins.date} <= ${filters.dateTo}`);
	}

	// Query: Get all votes with group results
	const deputyVotes = await db
		.select({
			position: votes.position,
			groupId: votes.groupId,
			category: scrutins.category,
			groupResults: scrutins.groupResults
		})
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.where(and(...conditions));

	// Calculate divergence by category (TypeScript side)
	const categoryStats = new Map<string, { totalVotes: number; divergentVotes: number }>();

	for (const vote of deputyVotes) {
		if (!vote.groupId || !vote.groupResults || !vote.position) continue;

		const results = vote.groupResults as Record<string, Record<string, unknown>>;
		const groupData = results[vote.groupId];
		if (!groupData) continue;

		const groupPos = getGroupMajorityPosition(groupData);
		if (!groupPos) continue;

		const category = vote.category || 'autre';
		const current = categoryStats.get(category) || { totalVotes: 0, divergentVotes: 0 };

		current.totalVotes++;
		if (vote.position.toLowerCase() !== groupPos) {
			current.divergentVotes++;
		}

		categoryStats.set(category, current);
	}

	// Aggregate results
	let totalComparableVotes = 0;
	let totalDivergentVotes = 0;
	const byCategory: AutonomyByCategory[] = [];

	for (const [category, stats] of categoryStats) {
		const total = stats.totalVotes;
		const divergent = stats.divergentVotes;

		totalComparableVotes += total;
		totalDivergentVotes += divergent;

		byCategory.push({
			category,
			label: CATEGORY_LABELS[category] || category,
			divergenceRate: total > 0 ? (divergent / total) * 100 : 0,
			divergentVotes: divergent,
			totalVotes: total
		});
	}

	// Not enough votes to show meaningful stats
	if (totalComparableVotes < MIN_VOTES_FOR_STATS) {
		return null;
	}

	// Sort by totalVotes descending
	byCategory.sort((a, b) => b.totalVotes - a.totalVotes);

	const stats: AutonomyStats = {
		divergenceRate: (totalDivergentVotes / totalComparableVotes) * 100,
		divergentVotes: totalDivergentVotes,
		totalComparableVotes,
		byCategory
	};

	// Cache the result
	setCachedAutonomyStats(actorId, groupId, filters, stats);

	return stats;
}

/**
 * Récupère les votes les plus divisifs d'un groupe.
 * Divisif = scrutin avec forte proportion de minorité (votes contre la position majoritaire).
 *
 * @param groupIds - IDs du groupe (peut inclure plusieurs si même shortName)
 * @param filters - Filtres de période
 * @param limit - Nombre max de résultats (default 20)
 * @returns Liste des votes divisifs triés par minorityRate décroissant
 */
export async function getDivisiveVotes(
	groupIds: string[],
	filters: PeriodFilters,
	limit = 20
): Promise<DivisiveVote[]> {
	// Build WHERE conditions
	const conditions: SQL[] = [inArray(votes.groupId, groupIds)];

	if (filters.legislature && filters.legislature !== 'all') {
		conditions.push(eq(scrutins.legislature, filters.legislature));
	}

	if (filters.dateFrom) {
		conditions.push(sql`${scrutins.date} >= ${filters.dateFrom}`);
	}

	if (filters.dateTo) {
		conditions.push(sql`${scrutins.date} <= ${filters.dateTo}`);
	}

	// Subquery: votes distribution by scrutin
	const votesDistribution = await db
		.select({
			scrutinId: votes.scrutinId,
			scrutinTitle: scrutins.title,
			scrutinDate: scrutins.date,
			scrutinCategory: scrutins.category,
			scrutinResult: scrutins.result,
			pour: sql<number>`SUM(CASE WHEN ${votes.position} = 'pour' THEN 1 ELSE 0 END)`,
			contre: sql<number>`SUM(CASE WHEN ${votes.position} = 'contre' THEN 1 ELSE 0 END)`,
			abstention: sql<number>`SUM(CASE WHEN ${votes.position} = 'abstention' THEN 1 ELSE 0 END)`,
			total: count()
		})
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.where(and(...conditions))
		.groupBy(
			votes.scrutinId,
			scrutins.id,
			scrutins.title,
			scrutins.date,
			scrutins.category,
			scrutins.result
		);

	// Calculate minorityRate and majorityPosition for each scrutin
	const divisiveVotes: DivisiveVote[] = votesDistribution
		.map((row) => {
			const { pour, contre, abstention, total } = row;

			// Determine majority position
			let majorityPosition: 'pour' | 'contre' | 'abstention' = 'pour';
			let majorityCount = pour;

			if (contre > majorityCount) {
				majorityPosition = 'contre';
				majorityCount = contre;
			}
			if (abstention > majorityCount) {
				majorityPosition = 'abstention';
				majorityCount = abstention;
			}

			// Minority rate = (min votes / total) * 100
			const minorityCount = Math.min(pour, contre, abstention);
			const minorityRate = total > 0 ? (minorityCount / total) * 100 : 0;

			return {
				scrutinId: row.scrutinId,
				scrutinTitle: row.scrutinTitle,
				scrutinDate: row.scrutinDate,
				category: row.scrutinCategory,
				result: row.scrutinResult,
				minorityRate,
				distribution: { pour, contre, abstention, total },
				majorityPosition
			};
		})
		.filter((v) => v.minorityRate > 0) // Only keep divided votes
		.sort((a, b) => b.minorityRate - a.minorityRate) // Most divisive first
		.slice(0, limit);

	return divisiveVotes;
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
	politicalPosition: number | null;
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
		.where(
			and(
				eq(mandates.legislature, legislature),
				eq(organs.type, 'GP'),
				notLike(organs.id, 'PO_GP_%') // Exclude artificial groups
			)
		)
		.groupBy(mandates.organId);

	const organIds = groupMemberCounts.map((g) => g.organId);
	if (organIds.length === 0) return [];

	const countByOrgan = new Map(groupMemberCounts.map((c) => [c.organId, Number(c.memberCount)]));

	// Get group details
	const groupDetails = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			color: organs.color,
			legislature: organs.legislature,
			politicalPosition: organs.politicalPosition
		})
		.from(organs)
		.where(inArray(organs.id, organIds));

	// Combine and sort by member count (descending)
	return groupDetails
		.map((g) => ({
			...g,
			memberCount: countByOrgan.get(g.id) || 0
		}))
		.filter((g) => g.memberCount > 0)
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
export function buildMandateOverlapConditions(periodDates: PeriodDates | null): SQL[] {
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
			politicalPosition: organs.politicalPosition,
			memberCount: count(sql`DISTINCT ${actors.id}`)
		})
		.from(organs)
		.innerJoin(mandates, eq(mandates.organId, organs.id))
		.innerJoin(actors, eq(mandates.actorId, actors.id))
		.where(and(...mandateConditions))
		.groupBy(organs.id, organs.name, organs.shortName, organs.color, organs.politicalPosition);

	return groupsWithMembers
		.map((g) => ({ ...g, memberCount: Number(g.memberCount) }))
		.sort((a, b) => b.memberCount - a.memberCount);
}

/**
 * Récupère les IDs des membres d'un groupe Sénat pour une période donnée.
 */
export async function getSenatGroupMemberIds(
	groupId: string,
	periodDates: PeriodDates | null
): Promise<string[]> {
	const memberConditions: SQL[] = [eq(mandates.organId, groupId), eq(actors.chamber, 'SENAT')];

	if (periodDates) {
		memberConditions.push(...buildMandateOverlapConditions(periodDates));
	}

	const memberIds = await db
		.selectDistinct({ id: actors.id })
		.from(actors)
		.innerJoin(mandates, eq(mandates.actorId, actors.id))
		.where(and(...memberConditions));

	return memberIds.map((m) => m.id);
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
			politicalPosition: organs.politicalPosition,
			memberCount: count(sql`DISTINCT ${actors.id}`)
		})
		.from(organs)
		.innerJoin(mandates, eq(mandates.organId, organs.id))
		.innerJoin(actors, eq(mandates.actorId, actors.id))
		.where(and(...mandateConditions))
		.groupBy(organs.id, organs.name, organs.shortName, organs.color, organs.politicalPosition);

	return groupsWithMembers
		.map((g) => ({ ...g, memberCount: Number(g.memberCount) }))
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
	const memberConditions: SQL[] = [eq(mandates.organId, groupId), eq(actors.chamber, 'PE')];

	if (terme && terme !== 'all' && periodDates) {
		memberConditions.push(...buildPEMandateConditions(terme, periodDates));
	}

	const memberIds = await db
		.selectDistinct({ id: actors.id })
		.from(actors)
		.innerJoin(mandates, eq(mandates.actorId, actors.id))
		.where(and(...memberConditions));

	return memberIds.map((m) => m.id);
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
export async function getScrutinCategories(whereClause?: SQL): Promise<ScrutinCategoryWithCount[]> {
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

// ===== Tight Votes (Votes Serrés) =====

/**
 * Seuils disponibles pour les votes serrés (en nombre de voix d'écart)
 */
export const TIGHT_VOTE_THRESHOLDS = [5, 10, 20] as const;
export type TightVoteThreshold = (typeof TIGHT_VOTE_THRESHOLDS)[number];
export const DEFAULT_TIGHT_THRESHOLD: TightVoteThreshold = 10;

/**
 * Labels UI pour les différents seuils
 */
export const TIGHT_THRESHOLD_LABELS: Record<TightVoteThreshold, string> = {
	5: 'Très serré (≤ 5 voix)',
	10: 'Serré (≤ 10 voix)',
	20: 'Assez serré (≤ 20 voix)'
};

/**
 * Un scrutin serré avec ses métadonnées essentielles
 */
export interface TightScrutin {
	id: string;
	number: number;
	date: string;
	title: string;
	category: string | null;
	result: string | null;
	totalFor: number;
	totalAgainst: number;
	margin: number;
	/** Égalité parfaite (margin = 0) */
	isTie: boolean;
}

/**
 * Statistiques des votes serrés pour un acteur
 */
export interface ActorTightVoteStats {
	/** Nombre total de participations dans des scrutins serrés */
	totalTightVotes: number;
	/** Nombre de votes dans le camp gagnant */
	winningVotes: number;
	/** Nombre de votes dans le camp perdant */
	losingVotes: number;
	/** Nombre de participations dans des égalités parfaites */
	tieVotes: number;
	/** Liste des votes serrés récents (limité) */
	recentTightVotes: TightVoteDetail[];
}

/**
 * Détail d'un vote serré pour un acteur
 */
export interface TightVoteDetail {
	scrutinId: string;
	scrutinTitle: string;
	scrutinDate: string;
	margin: number;
	isTie: boolean;
	actorPosition: 'pour' | 'contre' | 'abstention' | 'non-votant';
	result: string | null;
	/** L'acteur était-il dans le camp gagnant? null si égalité */
	wasWinning: boolean | null;
}

/**
 * Récupère les scrutins serrés (margin ≤ threshold)
 *
 * @param threshold - Seuil de marge (5, 10 ou 20 voix)
 * @param whereClause - Condition SQL additionnelle (ex: legislature)
 * @param limit - Nombre max de résultats
 * @param offset - Offset pour pagination
 * @returns Liste triée par margin ASC puis date DESC
 */
export async function getTightScrutins(
	threshold: TightVoteThreshold = DEFAULT_TIGHT_THRESHOLD,
	whereClause?: SQL,
	limit: number = 50,
	offset: number = 0
): Promise<TightScrutin[]> {
	const conditions = [sql`${scrutins.margin} <= ${threshold}`];
	if (whereClause) {
		conditions.push(whereClause);
	}

	const result = await db
		.select({
			id: scrutins.id,
			number: scrutins.number,
			date: scrutins.date,
			title: scrutins.title,
			category: scrutins.category,
			result: scrutins.result,
			totalFor: scrutins.totalFor,
			totalAgainst: scrutins.totalAgainst,
			margin: scrutins.margin
		})
		.from(scrutins)
		.where(and(...conditions))
		.orderBy(asc(scrutins.margin), desc(scrutins.date))
		.limit(limit)
		.offset(offset);

	return result.map((r) => ({
		...r,
		date: r.date.toString(),
		isTie: r.margin === 0
	}));
}

/**
 * Compte le nombre de scrutins serrés
 *
 * @param threshold - Seuil de marge
 * @param whereClause - Condition SQL additionnelle
 * @returns Nombre de scrutins avec margin <= threshold
 */
export async function countTightScrutins(
	threshold: TightVoteThreshold = DEFAULT_TIGHT_THRESHOLD,
	whereClause?: SQL
): Promise<number> {
	const conditions = [sql`${scrutins.margin} <= ${threshold}`];
	if (whereClause) {
		conditions.push(whereClause);
	}

	const result = await db
		.select({ count: count() })
		.from(scrutins)
		.where(and(...conditions));

	return Number(result[0]?.count || 0);
}

/**
 * Récupère les statistiques de votes serrés pour un acteur
 *
 * @param actorId - ID de l'acteur
 * @param threshold - Seuil de marge
 * @param whereClause - Condition SQL additionnelle (legislature)
 * @param recentLimit - Nombre de votes récents à inclure
 * @returns Statistiques agrégées + liste des votes récents
 */
export async function getActorTightVoteStats(
	actorId: string,
	threshold: TightVoteThreshold = DEFAULT_TIGHT_THRESHOLD,
	whereClause?: SQL,
	recentLimit: number = 10
): Promise<ActorTightVoteStats> {
	// Conditions sur les scrutins serrés
	const scrutinConditions = [sql`${scrutins.margin} <= ${threshold}`];
	if (whereClause) {
		scrutinConditions.push(whereClause);
	}

	// Récupérer tous les votes de l'acteur dans des scrutins serrés
	const votesData = await db
		.select({
			scrutinId: votes.scrutinId,
			scrutinNumber: scrutins.number,
			scrutinTitle: scrutins.title,
			scrutinDate: scrutins.date,
			scrutinResult: scrutins.result,
			margin: scrutins.margin,
			totalFor: scrutins.totalFor,
			totalAgainst: scrutins.totalAgainst,
			position: votes.position
		})
		.from(votes)
		.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
		.where(and(eq(votes.actorId, actorId), and(...scrutinConditions)))
		.orderBy(desc(scrutins.date))
		.limit(100); // Limite haute pour stats

	// Calculer les statistiques
	let winningVotes = 0;
	let losingVotes = 0;
	let tieVotes = 0;

	const recentTightVotes: TightVoteDetail[] = [];

	for (const vote of votesData) {
		const isTie = vote.margin === 0;
		let wasWinning: boolean | null = null;

		if (!isTie) {
			// Déterminer qui a gagné
			const forWon = vote.totalFor > vote.totalAgainst;
			// Déterminer si l'acteur était dans le camp gagnant
			if (vote.position === 'pour' && forWon) {
				wasWinning = true;
				winningVotes++;
			} else if (vote.position === 'contre' && !forWon) {
				wasWinning = true;
				winningVotes++;
			} else if (vote.position === 'pour' || vote.position === 'contre') {
				wasWinning = false;
				losingVotes++;
			}
			// abstention et non-votant ne comptent ni comme winning ni losing
		} else {
			tieVotes++;
		}

		// Ajouter aux récents (limité)
		if (recentTightVotes.length < recentLimit) {
			recentTightVotes.push({
				scrutinId: vote.scrutinId,
				scrutinTitle: vote.scrutinTitle,
				scrutinDate: vote.scrutinDate.toString(),
				margin: vote.margin,
				isTie,
				actorPosition: vote.position as 'pour' | 'contre' | 'abstention' | 'non-votant',
				result: vote.scrutinResult,
				wasWinning
			});
		}
	}

	return {
		totalTightVotes: votesData.length,
		winningVotes,
		losingVotes,
		tieVotes,
		recentTightVotes
	};
}

/**
 * Helper interne : détermine le label textuel selon la marge
 */
export function getTightLabel(margin: number): string | null {
	if (margin === 0) return 'Égalité parfaite';
	if (margin <= 5) return 'Très serré';
	if (margin <= 10) return 'Serré';
	if (margin <= 20) return 'Assez serré';
	return null;
}

// ===== Actor Groups Helpers =====

/**
 * Interface pour le groupe d'un acteur.
 */
export interface ActorGroup {
	id: string;
	name: string | null;
	shortName: string | null;
	color: string | null;
}

/**
 * Récupère les groupes parlementaires (GP) des acteurs donnés.
 * IMPORTANT: Les résultats sont ordonnés par startDate DESC pour garantir
 * que le groupe le plus récent est retourné en premier.
 *
 * @param actorIds - Liste des IDs d'acteurs
 * @param chamberFilter - Filtre optionnel sur la chambre (ex: 'SENAT', 'PE')
 * @returns Map actorId -> groupe
 *
 * @example
 * ```typescript
 * const actorIds = deputies.map(d => d.id);
 * const groupByActor = await getActorGroups(actorIds);
 * const deputiesWithGroups = deputies.map(d => ({
 *   ...d,
 *   group: groupByActor.get(d.id) || null
 * }));
 * ```
 */
export async function getActorGroups(
	actorIds: string[],
	chamberFilter?: 'AN' | 'SENAT' | 'PE'
): Promise<Map<string, ActorGroup>> {
	if (actorIds.length === 0) {
		return new Map();
	}

	// Build WHERE clause
	let whereClause = sql`${mandates.actorId} IN ${actorIds} AND ${organs.type} = 'GP'`;
	if (chamberFilter === 'SENAT') {
		whereClause = sql`${mandates.actorId} IN ${actorIds} AND ${organs.type} = 'GP' AND ${organs.chamber} = 'SENAT'`;
	} else if (chamberFilter === 'PE') {
		whereClause = sql`${mandates.actorId} IN ${actorIds} AND ${organs.type} = 'GP' AND ${organs.chamber} = 'PE'`;
	}

	// Query with ORDER BY startDate DESC to get most recent mandate first
	const groupsData = await db
		.select({
			actorId: mandates.actorId,
			groupId: organs.id,
			groupName: organs.name,
			groupShortName: organs.shortName,
			groupColor: organs.color,
			startDate: mandates.startDate
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(whereClause)
		.orderBy(desc(mandates.startDate));

	// Build lookup map - first entry for each actor wins (most recent due to ordering)
	const groupByActor = new Map<string, ActorGroup>();
	for (const g of groupsData) {
		if (!groupByActor.has(g.actorId) && g.groupId) {
			groupByActor.set(g.actorId, {
				id: g.groupId,
				name: g.groupName,
				shortName: g.groupShortName,
				color: g.groupColor
			});
		}
	}

	return groupByActor;
}

// ===== Expansion de termes via table search_synonyms =====

/**
 * Remplace les termes connus (acronymes, noms courants) par leur expansion officielle
 * en interrogeant la table search_synonyms.
 * Ex: "SMIC augmentation" → "salaire minimum interprofessionnel de croissance augmentation"
 */
export async function expandQueryTerms(query: string): Promise<string> {
	const words = query.split(/\s+/).filter(Boolean);
	if (words.length === 0) return query;
	const upperWords = words.map((w) => w.toUpperCase());

	// Les termes sont stockés en majuscules dans search_synonyms (ex: "SMIC")
	const synonyms = await db
		.select({ term: searchSynonyms.term, expansion: searchSynonyms.expansion })
		.from(searchSynonyms)
		.where(inArray(searchSynonyms.term, upperWords));

	if (synonyms.length === 0) return query;

	const map = new Map(synonyms.map((s) => [s.term.toUpperCase(), s.expansion]));
	return words.map((w) => map.get(w.toUpperCase()) ?? w).join(' ');
}

// ===== Full-Text Search Laws =====

/**
 * Expression tsvector pour la recherche full-text sur les lois.
 * DOIT matcher exactement l'expression de l'index GIN `laws_search_idx`.
 */
const lawsSearchVector = sql`to_tsvector('french', coalesce(${laws.title}, '') || ' ' || coalesce(${laws.description}, '') || ' ' || coalesce(${laws.theme}, ''))`;

/**
 * Sous-requête : IDs des lois dont un auteur/cosignataire matche le terme.
 * Permet de trouver "loi Duplomb" en cherchant "Duplomb".
 */
function authorMatchLawIds(searchTerm: string) {
	return db
		.selectDistinct({ lawId: lawCosignatories.lawId })
		.from(lawCosignatories)
		.innerJoin(actors, eq(actors.id, lawCosignatories.actorId))
		.where(or(ilike(actors.lastName, searchTerm), ilike(actors.fullName, searchTerm)));
}

/**
 * Recherche full-text sur les lois avec ranking par pertinence (ts_rank).
 * Cherche dans : title, description, theme (via index GIN) + noms des auteurs/cosignataires.
 * Fallback sur ILIKE si le tsquery échoue (caractères spéciaux, etc.).
 */
const lawFields = {
	id: laws.id,
	title: laws.title,
	shortTitle: laws.shortTitle,
	type: laws.type,
	status: laws.status,
	depositDate: laws.depositDate,
	legislature: laws.legislature,
	theme: laws.theme
};

export async function searchLaws(query: string, limit = 20) {
	const expandedQuery = await expandQueryTerms(query);
	const searchTerm = `%${query}%`;
	const authorMatch = authorMatchLawIds(searchTerm);

	try {
		const tsQuery = sql`plainto_tsquery('french', ${expandedQuery})`;

		return await db
			.select(lawFields)
			.from(laws)
			.where(or(sql`${lawsSearchVector} @@ ${tsQuery}`, inArray(laws.id, authorMatch)))
			.orderBy(desc(sql`ts_rank(${lawsSearchVector}, ${tsQuery})`))
			.limit(limit);
	} catch {
		// Fallback ILIKE si tsquery échoue
		return db
			.select(lawFields)
			.from(laws)
			.where(or(ilike(laws.title, searchTerm), inArray(laws.id, authorMatch)))
			.orderBy(desc(laws.depositDate))
			.limit(limit);
	}
}

// ===== Full-Text Search Scrutins =====

/**
 * Expression tsvector pour la recherche full-text sur les scrutins.
 * DOIT matcher exactement l'expression de l'index GIN `scrutins_search_idx`.
 */
const scrutinsSearchVector = sql`to_tsvector('french', coalesce(${scrutins.title}, '') || ' ' || coalesce(${scrutins.description}, ''))`;

/**
 * Résultat de vote d'un groupe pour un scrutin, calculé depuis groupResults.
 */
export interface GroupVoteResult {
	groupId: string;
	pour: number;
	contre: number;
	abstention: number;
	total: number;
	pctPour: number;
	pctContre: number;
	pctAbstention: number;
}

/**
 * Extrait le résultat de vote d'un groupe depuis le JSONB groupResults d'un scrutin.
 */
export function extractGroupVote(groupResults: unknown, groupId: string): GroupVoteResult | null {
	if (!groupResults || typeof groupResults !== 'object') return null;
	const data = (groupResults as Record<string, unknown>)[groupId];
	if (!data || typeof data !== 'object') return null;

	const d = data as Record<string, unknown>;
	const pour = (d.pour ?? d.for ?? 0) as number;
	const contre = (d.contre ?? d.against ?? 0) as number;
	const abstention = (d.abstention ?? 0) as number;
	const total = pour + contre + abstention;
	if (total === 0) return null;

	return {
		groupId,
		pour,
		contre,
		abstention,
		total,
		pctPour: Math.round((pour / total) * 100),
		pctContre: Math.round((contre / total) * 100),
		pctAbstention: Math.round((abstention / total) * 100)
	};
}

const scrutinFields = {
	id: scrutins.id,
	title: scrutins.title,
	date: scrutins.date,
	number: scrutins.number,
	legislature: scrutins.legislature,
	result: scrutins.result,
	groupResults: scrutins.groupResults
};

// Cache en mémoire pour les mots bruit (table stable, TTL 1h)
let noiseWordsCache: Set<string> | null = null;
let noiseWordsCacheExpiry = 0;

async function getNoiseWords(): Promise<Set<string>> {
	const now = Date.now();
	if (noiseWordsCache && now < noiseWordsCacheExpiry) return noiseWordsCache;
	const rows = await db.select({ word: searchNoiseWords.word }).from(searchNoiseWords);
	noiseWordsCache = new Set(rows.map((r) => r.word.toLowerCase()));
	noiseWordsCacheExpiry = now + 60 * 60 * 1000; // TTL 1h
	return noiseWordsCache;
}

/**
 * Retire les mots bruit (table search_noise_words) d'une requête fulltext scrutins.
 * Si tous les mots sont du bruit, retourne la requête originale (fallback safe).
 */
async function stripScrutinNoiseWords(query: string): Promise<string> {
	const noiseWords = await getNoiseWords();
	const words = query.split(/\s+/).filter(Boolean);
	const filtered = words.filter((w) => !noiseWords.has(w.toLowerCase()));
	return filtered.length > 0 ? filtered.join(' ') : query;
}

/**
 * Recherche fulltext sur les scrutins.
 * Stratégie double :
 * 1. Direct : fulltext ts_rank sur title + description du scrutin
 * 2. Indirect : via les lois liées (title + description + theme), pour les termes
 *    absents des titres parlementaires formels (acronymes, noms courants…)
 * Fallback ILIKE si tsquery échoue.
 */
export async function searchScrutins(query: string, limit = 20) {
	const expandedQuery = await expandQueryTerms(query);
	const ftsQuery = await stripScrutinNoiseWords(expandedQuery);
	try {
		// 1. Scrutins dont le titre/description matche directement
		const direct = await db
			.select(scrutinFields)
			.from(scrutins)
			.where(
				sql`to_tsvector('french', coalesce(${scrutins.title}, '') || ' ' || coalesce(${scrutins.description}, '')) @@ plainto_tsquery('french', ${ftsQuery})`
			)
			.orderBy(
				desc(
					sql`ts_rank(to_tsvector('french', coalesce(${scrutins.title}, '') || ' ' || coalesce(${scrutins.description}, '')), plainto_tsquery('french', ${ftsQuery}))`
				)
			)
			.limit(limit);

		if (direct.length >= limit) return direct;

		// 2. Scrutins liés à des lois dont la description/theme matche
		const lawsVec = sql`to_tsvector('french', coalesce(${laws.title}, '') || ' ' || coalesce(${laws.description}, '') || ' ' || coalesce(${laws.theme}, ''))`;
		const scrutinsVec = sql`to_tsvector('french', coalesce(${scrutins.title}, '') || ' ' || coalesce(${scrutins.description}, ''))`;
		const viaLaws = await db
			.selectDistinct(scrutinFields)
			.from(scrutins)
			.innerJoin(laws, eq(scrutins.lawId, laws.id))
			.where(
				and(
					sql`${lawsVec} @@ plainto_tsquery('french', ${ftsQuery})`,
					sql`NOT (${scrutinsVec} @@ plainto_tsquery('french', ${ftsQuery}))`
				)
			)
			.orderBy(desc(scrutins.date))
			.limit(limit - direct.length);

		return [...direct, ...viaLaws];
	} catch {
		// Fallback ILIKE si tsquery échoue
		return db
			.select(scrutinFields)
			.from(scrutins)
			.where(ilike(scrutins.title, `%${query}%`))
			.orderBy(desc(scrutins.date))
			.limit(limit);
	}
}

// ===== Law Implication Helpers =====

/**
 * Interface pour l'implication d'un acteur sur un texte de loi.
 */
export interface ActorLawImplication {
	lawId: string;
	lawTitle: string;
	lawType: string | null;
	depositDate: string | null;
	role: 'author' | 'cosignatory';
	signatureOrder: number | null;
}

/**
 * Récupère les textes de loi signés (auteur ou cosignataire) par un acteur.
 *
 * @param actorId - ID de l'acteur
 * @param limit - Nombre maximum de résultats (défaut: 50)
 * @returns Liste des textes signés avec le rôle de l'acteur
 */
export async function getActorLawsImplication(
	actorId: string,
	limit = 50
): Promise<ActorLawImplication[]> {
	const results = await db
		.select({
			lawId: lawCosignatories.lawId,
			lawTitle: laws.title,
			lawType: laws.type,
			depositDate: laws.depositDate,
			role: lawCosignatories.role,
			signatureOrder: lawCosignatories.signatureOrder
		})
		.from(lawCosignatories)
		.innerJoin(laws, eq(laws.id, lawCosignatories.lawId))
		.where(eq(lawCosignatories.actorId, actorId))
		.orderBy(desc(laws.depositDate), asc(lawCosignatories.signatureOrder))
		.limit(limit);

	return results.map((r) => ({
		...r,
		role: r.role as 'author' | 'cosignatory'
	}));
}

/**
 * Interface pour les contributeurs d'un texte de loi.
 */
export interface LawContributor {
	actorId: string;
	actorName: string;
	role: 'author' | 'cosignatory';
	signatureOrder: number | null;
}

/**
 * Récupère les contributeurs (auteurs et cosignataires) d'un texte de loi.
 *
 * @param lawId - ID du texte de loi
 * @returns Liste des contributeurs avec leur rôle
 */
export async function getLawContributors(lawId: string): Promise<LawContributor[]> {
	const results = await db
		.select({
			actorId: lawCosignatories.actorId,
			firstName: actors.firstName,
			lastName: actors.lastName,
			role: lawCosignatories.role,
			signatureOrder: lawCosignatories.signatureOrder
		})
		.from(lawCosignatories)
		.innerJoin(actors, eq(actors.id, lawCosignatories.actorId))
		.where(eq(lawCosignatories.lawId, lawId))
		.orderBy(asc(lawCosignatories.signatureOrder), asc(actors.lastName));

	return results.map((r) => ({
		actorId: r.actorId,
		actorName: `${r.firstName} ${r.lastName}`,
		role: r.role as 'author' | 'cosignatory',
		signatureOrder: r.signatureOrder
	}));
}
