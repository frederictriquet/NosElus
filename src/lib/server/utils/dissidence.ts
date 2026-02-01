/**
 * Utilities for calculating deputy autonomy (divergence from group majority).
 *
 * Autonomy = percentage of votes where deputy differs from their group's majority position.
 * Divisiveness = percentage of minority votes within a group (higher = more divided).
 */

import type { PeriodFilters } from '../api/helpers';

/**
 * Stats d'autonomie de vote d'un député par rapport à son groupe
 */
export interface AutonomyStats {
	/** Taux de divergence global (0-100%) */
	divergenceRate: number;
	/** Nombre de votes divergents */
	divergentVotes: number;
	/** Nombre total de votes comparables (avec position de groupe) */
	totalComparableVotes: number;
	/** Breakdown par catégorie de scrutin */
	byCategory: AutonomyByCategory[];
}

export interface AutonomyByCategory {
	/** Catégorie de scrutin (vote-final, amendement, etc.) */
	category: string;
	/** Label affiché */
	label: string;
	/** Taux de divergence pour cette catégorie (0-100%) */
	divergenceRate: number;
	/** Nombre de votes divergents */
	divergentVotes: number;
	/** Nombre total de votes comparables */
	totalVotes: number;
}

/**
 * Vote divisif au sein d'un groupe
 */
export interface DivisiveVote {
	/** ID du scrutin */
	scrutinId: string;
	/** Titre du scrutin */
	scrutinTitle: string;
	/** Date du scrutin */
	scrutinDate: string;
	/** Catégorie du scrutin */
	category: string | null;
	/** Résultat du scrutin */
	result: string | null;
	/** Taux de minorité (0-50%) - plus élevé = plus divisif */
	minorityRate: number;
	/** Distribution des votes dans le groupe */
	distribution: {
		pour: number;
		contre: number;
		abstention: number;
		total: number;
	};
	/** Position majoritaire du groupe */
	majorityPosition: 'pour' | 'contre' | 'abstention';
}

/** Seuil de divergence pour afficher le badge "Vote autonome" (15%) */
export const AUTONOMY_THRESHOLD = 15;

/** Seuil minimum de votes pour afficher des stats (éviter biais sur petit échantillon) */
export const MIN_VOTES_FOR_STATS = 10;

/** Durée du cache in-memory (1 heure) */
export const CACHE_DURATION = 60 * 60 * 1000;

/** Labels des catégories de scrutin */
export const CATEGORY_LABELS: Record<string, string> = {
	'vote-final': 'Votes finaux',
	article: 'Articles',
	amendement: 'Amendements',
	procédure: 'Procédures',
	budget: 'Budget',
	constitutionnel: 'Constitutionnel',
	autre: 'Autres'
};

/**
 * Structure du cache d'autonomie
 */
interface CachedAutonomyStats {
	stats: AutonomyStats;
	timestamp: number;
}

/**
 * Cache in-memory pour les stats d'autonomie
 * Clé : actorId_groupId_legislature
 */
const autonomyCache = new Map<string, CachedAutonomyStats>();

/**
 * Génère une clé de cache pour les stats d'autonomie
 */
export function getAutonomyCacheKey(
	actorId: string,
	groupId: string | null,
	filters: PeriodFilters
): string {
	const legislature = filters.legislature ?? 'all';
	const group = groupId ?? 'auto';
	return `${actorId}_${group}_${legislature}`;
}

/**
 * Récupère les stats d'autonomie depuis le cache si valide
 */
export function getCachedAutonomyStats(
	actorId: string,
	groupId: string | null,
	filters: PeriodFilters
): AutonomyStats | null {
	const cacheKey = getAutonomyCacheKey(actorId, groupId, filters);
	const cached = autonomyCache.get(cacheKey);

	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		return cached.stats;
	}

	return null;
}

/**
 * Met en cache les stats d'autonomie
 */
export function setCachedAutonomyStats(
	actorId: string,
	groupId: string | null,
	filters: PeriodFilters,
	stats: AutonomyStats
): void {
	const cacheKey = getAutonomyCacheKey(actorId, groupId, filters);
	autonomyCache.set(cacheKey, { stats, timestamp: Date.now() });
}

/**
 * Nettoie les entrées expirées du cache (appelé périodiquement)
 */
export function cleanAutonomyCache(): void {
	const now = Date.now();
	for (const [key, value] of autonomyCache.entries()) {
		if (now - value.timestamp >= CACHE_DURATION) {
			autonomyCache.delete(key);
		}
	}
}
