/** Position dominante d'un groupe politique sur un ensemble de scrutins. */
export type DominantPosition = 'pour' | 'contre' | 'abstention';

/**
 * Détermine la position dominante d'un groupe sur un ensemble de scrutins.
 *
 * En cas d'égalité stricte entre deux positions (ex: 5 pour, 5 contre, 0 abstention),
 * la priorité est : pour > contre > abstention.
 *
 * @param bilan - Compteurs de scrutins par position pour ce groupe
 * @returns La position la plus fréquente parmi pour/contre/abstention
 */
export function getDominant(bilan: {
	scrutinsPour: number;
	scrutinsContre: number;
	scrutinsAbstention: number;
}): DominantPosition {
	if (
		bilan.scrutinsPour >= bilan.scrutinsContre &&
		bilan.scrutinsPour >= bilan.scrutinsAbstention
	) {
		return 'pour';
	}
	if (
		bilan.scrutinsContre >= bilan.scrutinsPour &&
		bilan.scrutinsContre >= bilan.scrutinsAbstention
	) {
		return 'contre';
	}
	return 'abstention';
}
