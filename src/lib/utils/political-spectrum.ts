/**
 * Utilitaires pour le tri des groupes politiques par position sur l'échiquier
 *
 * Permet de trier les groupes parlementaires de gauche à droite
 * en utilisant les positions stockées en base de données.
 *
 * @example
 * ```typescript
 * import { sortByPoliticalPosition } from '$lib/utils/political-spectrum';
 *
 * const sortedGroups = sortByPoliticalPosition(groups);
 * // Résultat: [LFI (1.5), GDR (2.0), ..., RN (8.5), NI (999)]
 * ```
 *
 * @see ADR-004 : adr-2026-02-04-political-positioning-automation.md
 */

/**
 * Organ minimal pour le tri (compatible avec Organ de la DB)
 */
export interface OrganWithPosition {
	id: string;
	shortName: string | null;
	name: string;
	politicalPosition: number | null;
}

/**
 * Options de configuration pour le tri
 */
export interface SortOptions {
	/** Position pour les Non-Inscrits (défaut: 999) */
	niPosition?: number;
	/** Position par défaut si null (défaut: 5.0 = centre) */
	defaultPosition?: number;
	/** Identifiants des groupes NI à détecter */
	niIdentifiers?: string[];
}

/** Position par défaut pour les Non-Inscrits */
const DEFAULT_NI_POSITION = 999;

/** Position par défaut si inconnue (centre) */
const DEFAULT_POSITION = 5.0;

/** Identifiants courants pour les groupes Non-Inscrits */
const DEFAULT_NI_IDENTIFIERS = ['NI', 'NA', 'Non-inscrit', 'Non-inscrits'];

/**
 * Vérifie si un groupe est "Non-inscrit" basé sur son nom ou shortName
 *
 * @param organ - Groupe à vérifier
 * @param niIdentifiers - Identifiants NI à rechercher
 * @returns true si le groupe est NI
 */
export function isNonInscrit(
	organ: OrganWithPosition,
	niIdentifiers: string[] = DEFAULT_NI_IDENTIFIERS
): boolean {
	const name = organ.name.toLowerCase();
	const shortName = organ.shortName?.toLowerCase() || '';

	for (const ni of niIdentifiers) {
		const niLower = ni.toLowerCase();
		if (shortName === niLower || name.includes(niLower)) {
			return true;
		}
	}

	return false;
}

/**
 * Obtient la position effective d'un groupe avec fallbacks
 *
 * Priorité :
 * 1. Position en DB (si non-null)
 * 2. Position NI (si groupe NI détecté)
 * 3. Position par défaut (centre)
 *
 * @param organ - Groupe politique
 * @param options - Options de configuration
 * @returns Position effective pour le tri
 */
export function getEffectivePosition(
	organ: OrganWithPosition,
	options?: SortOptions
): number {
	const niPosition = options?.niPosition ?? DEFAULT_NI_POSITION;
	const defaultPosition = options?.defaultPosition ?? DEFAULT_POSITION;
	const niIdentifiers = options?.niIdentifiers ?? DEFAULT_NI_IDENTIFIERS;

	// 1. Position explicite en DB
	if (organ.politicalPosition !== null && organ.politicalPosition !== undefined) {
		return organ.politicalPosition;
	}

	// 2. Détection NI
	if (isNonInscrit(organ, niIdentifiers)) {
		return niPosition;
	}

	// 3. Défaut (centre)
	return defaultPosition;
}

/**
 * Trie les groupes politiques par position sur l'échiquier
 *
 * Ordre: Gauche (0) → Droite (10) → Non-Inscrits (999)
 *
 * @param organs - Liste des groupes à trier
 * @param options - Options de configuration
 * @returns Nouvelle liste triée (ne modifie pas l'originale)
 *
 * @example
 * ```typescript
 * const groups = await loadGroups();
 * const sorted = sortByPoliticalPosition(groups);
 * // [LFI, GDR, SOC, ..., RN, NI]
 * ```
 */
export function sortByPoliticalPosition<T extends OrganWithPosition>(
	organs: T[],
	options?: SortOptions
): T[] {
	return [...organs].sort((a, b) => {
		const posA = getEffectivePosition(a, options);
		const posB = getEffectivePosition(b, options);

		// Tri par position croissante
		if (posA !== posB) {
			return posA - posB;
		}

		// En cas d'égalité, tri alphabétique par nom
		return a.name.localeCompare(b.name);
	});
}

/**
 * Groupe les organs par catégorie politique
 *
 * @param organs - Liste des groupes
 * @param options - Options de configuration
 * @returns Objet avec groupes classés par catégorie
 */
export function groupByPoliticalCategory<T extends OrganWithPosition>(
	organs: T[],
	options?: SortOptions
): { left: T[]; center: T[]; right: T[]; ni: T[] } {
	const result = {
		left: [] as T[], // 0-4
		center: [] as T[], // 4-6
		right: [] as T[], // 6-10
		ni: [] as T[] // 999+
	};

	for (const organ of organs) {
		const pos = getEffectivePosition(organ, options);

		if (pos >= 100) {
			result.ni.push(organ);
		} else if (pos < 4) {
			result.left.push(organ);
		} else if (pos <= 6) {
			result.center.push(organ);
		} else {
			result.right.push(organ);
		}
	}

	// Trier chaque catégorie
	result.left = sortByPoliticalPosition(result.left, options);
	result.center = sortByPoliticalPosition(result.center, options);
	result.right = sortByPoliticalPosition(result.right, options);
	result.ni = sortByPoliticalPosition(result.ni, options);

	return result;
}
