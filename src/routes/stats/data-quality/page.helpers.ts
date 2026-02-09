/**
 * @fileoverview Helpers pour le dashboard qualité des données.
 * Fournit les fonctions de tri, formatage et classification pour le tableau
 * interactif des statistiques par mandature.
 *
 * Architecture :
 * - Configuration déclarative des colonnes via `COLUMNS`
 * - Tri côté client pour réactivité instantanée
 * - Tri naturel des législatures (1, 2, 10, 17 au lieu de 1, 10, 17, 2)
 *
 * @module stats/data-quality/helpers
 */

import type { LegislatureStats } from './+page.server';

/**
 * Identifiant de colonne triable dans le tableau des mandatures.
 * Chaque clé correspond à une colonne du tableau.
 */
export type SortableColumn =
	| 'legislature' // Tri naturel par numéro de mandature
	| 'totalLaws' // Tri par nombre total de lois
	| 'votes' // Tri par pourcentage de lois avec votes
	| 'ai' // Tri par pourcentage de lois analysées IA
	| 'tags' // Tri par pourcentage de lois avec tags
	| 'description' // Tri par pourcentage de lois avec texte complet
	| 'scrutins'; // Tri par nombre de scrutins

/**
 * Configuration d'une colonne du tableau.
 * Permet un rendu générique des en-têtes de colonnes en mode boucle.
 */
export interface ColumnConfig {
	/** Identifiant unique de la colonne (correspond à SortableColumn) */
	key: SortableColumn;
	/** Label affiché dans l'en-tête du tableau */
	label: string;
	/** Alignement du texte dans la colonne */
	align: 'left' | 'right';
	/**
	 * Fonction d'extraction de la valeur à trier.
	 * Permet un tri unifié via getValue(a) - getValue(b).
	 * Pour les pourcentages, retourne le % calculé, pas le ratio.
	 */
	getValue: (row: LegislatureStats) => number;
}

/**
 * Configuration déclarative des 7 colonnes du tableau.
 *
 * Pattern :
 * - Définition centralisée évite la duplication code/template
 * - Permet génération des <th> via {#each COLUMNS}
 * - Tri unifié via getValue() : sort((a, b) => getValue(a) - getValue(b))
 *
 * Colonnes :
 * 1. legislature : Tri naturel (1, 2, 10 au lieu de 1, 10, 2)
 * 2. totalLaws : Nombre de lois
 * 3-6. votes/ai/tags/description : Pourcentages de couverture
 * 7. scrutins : Nombre de scrutins
 *
 * @see sortLegislatureStats pour l'utilisation
 */
export const COLUMNS: ColumnConfig[] = [
	{
		key: 'legislature',
		label: 'Mandature',
		align: 'left',
		getValue: (row) => extractLegislatureNumber(row.legislature)
	},
	{ key: 'totalLaws', label: 'Lois', align: 'right', getValue: (row) => row.totalLaws },
	{
		key: 'votes',
		label: 'Avec votes',
		align: 'right',
		getValue: (row) => percentage(row.lawsWithVotes, row.totalLaws)
	},
	{
		key: 'ai',
		label: 'Analysées IA',
		align: 'right',
		getValue: (row) => percentage(row.lawsWithSummaries, row.totalLaws)
	},
	{
		key: 'tags',
		label: 'Avec tags',
		align: 'right',
		getValue: (row) => percentage(row.lawsWithTags, row.totalLaws)
	},
	{
		key: 'description',
		label: 'Texte complet',
		align: 'right',
		getValue: (row) => percentage(row.lawsWithDescription, row.totalLaws)
	},
	{ key: 'scrutins', label: 'Scrutins', align: 'right', getValue: (row) => row.totalScrutins }
];

/**
 * Extrait le numéro de mandature pour permettre un tri naturel.
 *
 * **Problème résolu** : Tri lexicographique de "1", "10", "17", "2" donne 1, 10, 17, 2.
 * En extrayant le numéro, on obtient l'ordre naturel : 1, 2, 10, 17.
 *
 * Formats supportés :
 * - AN : "17" → 17 (Assemblée Nationale, 17e législature)
 * - PE : "PE-10" → 10 (Parlement Européen, 10e terme)
 * - SENAT : "SE-2023" → 2023 (Sénat, renouvellement 2023)
 *
 * @param legislature - Identifiant de la mandature (format: "N", "PE-N", ou "SE-YYYY")
 * @returns Le numéro extrait, ou 0 si aucun chiffre trouvé
 *
 * @example
 * ```typescript
 * extractLegislatureNumber('17')       // → 17
 * extractLegislatureNumber('PE-10')    // → 10
 * extractLegislatureNumber('SE-2023')  // → 2023
 * extractLegislatureNumber('invalid')  // → 0
 * ```
 */
export function extractLegislatureNumber(legislature: string): number {
	const match = legislature.match(/(\d+)/);
	return match ? Number(match[1]) : 0;
}

/**
 * Map pré-calculée pour accès O(1) aux configs de colonnes.
 * Utilisée par sortLegislatureStats pour éviter find() à chaque tri.
 */
const COLUMNS_MAP = new Map(COLUMNS.map((c) => [c.key, c]));

/**
 * Trie les statistiques de mandature selon la colonne et direction spécifiées.
 *
 * **Architecture** :
 * - Tri côté client pour réactivité instantanée
 * - Utilise getValue() de COLUMNS_MAP pour uniformité
 * - Immutable : retourne une copie triée, ne mute pas l'original
 *
 * **Tri naturel** : La colonne 'legislature' utilise extractLegislatureNumber()
 * pour obtenir un ordre naturel (1, 2, 10 au lieu de 1, 10, 2).
 *
 * **Performance** : O(n log n) tri, O(1) lookup colonne via Map.
 *
 * @param data - Tableau des statistiques à trier
 * @param column - Identifiant de la colonne de tri
 * @param direction - Direction du tri ('asc' ou 'desc')
 * @returns Nouveau tableau trié (l'original n'est pas modifié)
 *
 * @example
 * ```typescript
 * const stats = [
 *   { legislature: '17', totalLaws: 100, ... },
 *   { legislature: '1', totalLaws: 50, ... },
 *   { legislature: '10', totalLaws: 200, ... }
 * ];
 *
 * // Tri naturel par legislature
 * sortLegislatureStats(stats, 'legislature', 'asc');
 * // → ['1', '10', '17'] (ordre naturel)
 *
 * // Tri par nombre de lois
 * sortLegislatureStats(stats, 'totalLaws', 'desc');
 * // → [200, 100, 50]
 *
 * // Tri par pourcentage de votes
 * sortLegislatureStats(stats, 'votes', 'asc');
 * // → trie par lawsWithVotes / totalLaws * 100
 * ```
 */
export function sortLegislatureStats(
	data: LegislatureStats[],
	column: SortableColumn,
	direction: 'asc' | 'desc'
): LegislatureStats[] {
	const col = COLUMNS_MAP.get(column);
	if (!col) return data;
	const mult = direction === 'asc' ? 1 : -1;
	return [...data].sort((a, b) => mult * (col.getValue(a) - col.getValue(b)));
}

/**
 * Formate un identifiant de mandature en label lisible selon la chambre.
 *
 * Nomenclature :
 * - **AN** (Assemblée Nationale) : "17" → "17e législature"
 * - **PE** (Parlement Européen) : "PE-10" → "10e terme"
 * - **SENAT** : "SE-2023" → "Renouvellement 2023"
 *
 * @param legislature - Identifiant brut de la mandature
 * @returns Label formaté pour affichage UI
 *
 * @example
 * ```typescript
 * formatLegislature('17')       // → '17e législature'
 * formatLegislature('PE-10')    // → '10e terme'
 * formatLegislature('SE-2023')  // → 'Renouvellement 2023'
 * ```
 */
export function formatLegislature(legislature: string): string {
	if (legislature.startsWith('PE-')) {
		const num = legislature.replace('PE-', '');
		return `${num}e terme`;
	}
	if (legislature.startsWith('SE-')) {
		const num = legislature.replace('SE-', '');
		return `Renouvellement ${num}`;
	}
	return `${legislature}e législature`;
}

/**
 * Calcule un pourcentage avec protection contre la division par zéro.
 *
 * **Sécurité** : Retourne 0 si total <= 0 pour éviter NaN/Infinity.
 *
 * @param value - Numérateur (valeurs avec propriété)
 * @param total - Dénominateur (total de valeurs)
 * @returns Pourcentage (0-100+), ou 0 si division impossible
 *
 * @example
 * ```typescript
 * percentage(50, 100)  // → 50.0
 * percentage(1, 3)     // → 33.333...
 * percentage(10, 0)    // → 0 (évite division par zéro)
 * percentage(110, 100) // → 110 (peut dépasser 100% si anomalie données)
 * ```
 */
export function percentage(value: number, total: number): number {
	return total > 0 ? (value / total) * 100 : 0;
}

/**
 * Détermine la classe CSS de couleur selon le taux de couverture.
 *
 * Seuils de qualité des données :
 * - **>75%** : coverage-high (vert) — excellente couverture
 * - **25-75%** : coverage-medium (orange) — couverture moyenne
 * - **<25%** : coverage-low (rouge) — faible couverture
 *
 * Utilisé pour les barres de progression et les labels colorés.
 *
 * @param pct - Pourcentage de couverture (0-100)
 * @returns Classe CSS ('coverage-high', 'coverage-medium', ou 'coverage-low')
 *
 * @example
 * ```typescript
 * coverageClass(80)   // → 'coverage-high'
 * coverageClass(50)   // → 'coverage-medium'
 * coverageClass(10)   // → 'coverage-low'
 * coverageClass(75)   // → 'coverage-medium' (seuil inclusif)
 * coverageClass(75.1) // → 'coverage-high'
 * ```
 */
export function coverageClass(pct: number): string {
	if (pct > 75) return 'coverage-high';
	if (pct > 25) return 'coverage-medium';
	return 'coverage-low';
}
