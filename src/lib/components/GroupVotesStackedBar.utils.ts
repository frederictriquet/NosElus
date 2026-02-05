/**
 * Utilitaires pour le composant GroupVotesStackedBar
 *
 * Ce module fournit des fonctions pures pour préparer les données de votes par groupe
 * politique avant leur transformation en graphiques empilés (stacked bar charts).
 *
 * Extraites du composant Svelte pour :
 * - Permettre les tests unitaires sans dépendance Svelte
 * - Améliorer la réutilisabilité et la maintenabilité
 * - Garantir la type-safety avec TypeScript
 *
 * @module GroupVotesStackedBar.utils
 * @see {@link GroupVotesStackedBar.svelte} - Composant utilisant ces utilitaires
 */

/**
 * Données de vote d'un groupe politique pour un scrutin
 *
 * @interface GroupData
 */
export interface GroupData {
	/** Identifiant unique du groupe (ex: "PO123456") */
	id: string;
	/** Nom complet du groupe (ex: "La France Insoumise - Nouveau Front Populaire") */
	name: string;
	/** Nom court du groupe (ex: "LFI-NFP"), null si non défini */
	shortName: string | null;
	/** Couleur hexadécimale du groupe (ex: "#C9462C"), null si non définie */
	color: string | null;
	/** Nombre de votes "Pour" */
	pour: number;
	/** Nombre de votes "Contre" */
	contre: number;
	/** Nombre d'abstentions */
	abstention: number;
	/** Nombre de non-votants */
	nonVotant: number;
	/** Total des votes (pour + contre + abstention + nonVotant) */
	total: number;
}

/**
 * Mapping explicite des libellés de positions vers les clés de GroupData
 *
 * Utilisé pour garantir la type-safety lors de l'accès aux propriétés de vote.
 * Évite les type assertions dangereuses (ex: `pos.toLowerCase() as 'pour'`).
 *
 * @internal
 */
const positionKeyMap: Record<string, keyof Pick<GroupData, 'pour' | 'contre' | 'abstention' | 'nonVotant'>> = {
	'Pour': 'pour',
	'Contre': 'contre',
	'Abstention': 'abstention',
	'Non-votant': 'nonVotant'
};

/**
 * Positions de vote dans l'ordre d'affichage standard
 *
 * Ordre cohérent avec les conventions UI du projet :
 * Pour (vert) → Contre (rouge) → Abstention (jaune) → Non-votant (gris)
 *
 * @constant
 */
export const VOTE_POSITIONS = ['Pour', 'Contre', 'Abstention', 'Non-votant'] as const;

/**
 * Trie les groupes par total de votes (descendant) et limite le nombre
 *
 * Les groupes avec le plus de votes apparaissent en premier, permettant
 * d'afficher les groupes les plus significatifs dans les graphiques.
 *
 * @param groups - Tableau des groupes politiques avec leurs votes
 * @param maxGroups - Nombre maximum de groupes à retourner
 * @returns Nouveau tableau trié et limité (ne modifie pas l'original)
 *
 * @example
 * ```typescript
 * const groups = [
 *   { id: 'A', total: 10, ... },
 *   { id: 'B', total: 30, ... },
 *   { id: 'C', total: 20, ... }
 * ];
 *
 * sortAndLimitGroups(groups, 2);
 * // => [{ id: 'B', total: 30 }, { id: 'C', total: 20 }]
 * ```
 */
export function sortAndLimitGroups(groups: GroupData[], maxGroups: number): GroupData[] {
	return [...groups]
		.sort((a, b) => b.total - a.total)
		.slice(0, maxGroups);
}

/**
 * Prépare les données pour le mode "by-group"
 *
 * **Mode d'affichage** : Une barre par groupe politique, empilée par position de vote.
 *
 * Transformation :
 * - Axe X : Groupes politiques (LFI, RN, Renaissance, etc.)
 * - Axe Y : Nombre de votes
 * - Empilement : Pour/Contre/Abstention/Non-votant (couleurs des positions)
 *
 * @param groups - Tableau des groupes politiques avec leurs votes
 * @param maxGroups - Nombre maximum de groupes à inclure (défaut: 10)
 * @returns Objet avec les données formatées pour d3-shape/stack, ou null si vide
 *
 * @example
 * ```typescript
 * const groups = [
 *   { id: 'LFI', shortName: 'LFI', pour: 50, contre: 10, abstention: 5, nonVotant: 2, total: 67, ... }
 * ];
 *
 * prepareByGroupData(groups, 10);
 * // => {
 * //   seriesNames: ['pour', 'contre', 'abstention', 'nonVotant'],
 * //   dataForStack: [{ label: 'LFI', pour: 50, contre: 10, ... }]
 * // }
 * ```
 */
export function prepareByGroupData(groups: GroupData[], maxGroups: number) {
	const sortedGroups = sortAndLimitGroups(groups, maxGroups);

	if (sortedGroups.length === 0) return null;

	const seriesNames = ['pour', 'contre', 'abstention', 'nonVotant'];

	const dataForStack = sortedGroups.map((g) => ({
		label: g.shortName || g.name.slice(0, 10),
		fullName: g.name,
		pour: g.pour,
		contre: g.contre,
		abstention: g.abstention,
		nonVotant: g.nonVotant,
		total: g.total
	}));

	return { seriesNames, dataForStack };
}

/**
 * Prépare les données pour le mode "by-position"
 *
 * **Mode d'affichage** : Une barre par position de vote, empilée par groupe politique.
 *
 * Transformation :
 * - Axe X : Positions de vote (Pour, Contre, Abstention, Non-votant)
 * - Axe Y : Nombre de votes
 * - Empilement : Groupes politiques (couleurs des groupes)
 *
 * @param groups - Tableau des groupes politiques avec leurs votes
 * @param maxGroups - Nombre maximum de groupes à inclure (défaut: 10)
 * @returns Objet avec les données formatées pour d3-shape/stack, ou null si vide
 *
 * @example
 * ```typescript
 * const groups = [
 *   { id: 'LFI', shortName: 'LFI', pour: 50, contre: 10, ... },
 *   { id: 'RN', shortName: 'RN', pour: 30, contre: 40, ... }
 * ];
 *
 * prepareByPositionData(groups, 10);
 * // => {
 * //   dataForStack: [
 * //     { label: 'Pour', LFI: 50, RN: 30, total: 80 },
 * //     { label: 'Contre', LFI: 10, RN: 40, total: 50 },
 * //     ...
 * //   ],
 * //   groupNames: ['LFI', 'RN'],
 * //   sortedGroups: [...]
 * // }
 * ```
 */
export function prepareByPositionData(groups: GroupData[], maxGroups: number) {
	const sortedGroups = sortAndLimitGroups(groups, maxGroups);

	if (sortedGroups.length === 0) return null;

	const groupNames = sortedGroups.map((g) => g.shortName || g.id);

	const dataForStack = VOTE_POSITIONS.map((pos) => {
		const posKey = positionKeyMap[pos];
		const row: Record<string, unknown> = { label: pos };
		let total = 0;
		sortedGroups.forEach((g, i) => {
			row[groupNames[i]] = g[posKey];
			total += g[posKey];
		});
		row['total'] = total;
		return row;
	});

	return { dataForStack, groupNames, sortedGroups };
}
