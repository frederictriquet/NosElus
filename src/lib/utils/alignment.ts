/**
 * Utilitaires pour le calcul d'alignement politique.
 *
 * Implémente l'algorithme de similarité Jaccard pour comparer
 * les votes utilisateur avec les votes des groupes parlementaires.
 */

export interface UserVote {
	lawId: string;
	position: 'pour' | 'contre';
}

export interface GroupVote {
	lawId: string;
	majorityPosition: 'pour' | 'contre';
}

export interface AlignmentResult {
	groupId: string;
	groupName: string;
	groupShortName: string;
	score: number; // Pourcentage 0-100
	agreements: number; // Nombre d'accords
	disagreements: number; // Nombre de désaccords
	details: VoteComparison[];
}

export interface VoteComparison {
	lawId: string;
	lawTitle: string;
	userPosition: 'pour' | 'contre';
	groupPosition: 'pour' | 'contre';
	agreement: boolean;
}

/**
 * Calcule le score d'alignement entre les votes utilisateur et un groupe.
 *
 * Utilise la similarité de Jaccard : % de votes en accord.
 *
 * @param userVotes - Votes de l'utilisateur sur les lois du quiz
 * @param groupVotes - Votes majoritaires du groupe sur les mêmes lois
 * @returns Score d'alignement (0-100)
 *
 * @example
 * ```typescript
 * const userVotes = [
 *   { lawId: 'L1', position: 'pour' },
 *   { lawId: 'L2', position: 'contre' }
 * ];
 * const groupVotes = [
 *   { lawId: 'L1', majorityPosition: 'pour' },
 *   { lawId: 'L2', majorityPosition: 'pour' }
 * ];
 * const score = calculateAlignmentScore(userVotes, groupVotes);
 * // => 50 (1 accord sur 2 votes)
 * ```
 */
export function calculateAlignmentScore(
	userVotes: UserVote[],
	groupVotes: GroupVote[]
): number {
	if (userVotes.length === 0) return 0;

	// Créer un map pour accès rapide aux votes du groupe
	const groupVoteMap = new Map(groupVotes.map((v) => [v.lawId, v.majorityPosition]));

	// Compter les accords
	const agreements = userVotes.filter((uv) => {
		const groupPosition = groupVoteMap.get(uv.lawId);
		return groupPosition && uv.position === groupPosition;
	}).length;

	// Calculer le pourcentage (arrondi à l'entier)
	return Math.round((agreements / userVotes.length) * 100);
}

/**
 * Calcule l'alignement détaillé avec un groupe parlementaire.
 *
 * Inclut le score global, le nombre d'accords/désaccords,
 * et le détail vote par vote.
 *
 * @param userVotes - Votes de l'utilisateur
 * @param groupVotes - Votes du groupe
 * @param groupInfo - Informations sur le groupe (nom, etc.)
 * @param lawTitles - Map lawId → titre pour le détail
 * @returns Résultat complet avec détails
 */
export function calculateDetailedAlignment(
	userVotes: UserVote[],
	groupVotes: GroupVote[],
	groupInfo: { id: string; name: string; shortName: string },
	lawTitles: Map<string, string>
): AlignmentResult {
	const groupVoteMap = new Map(groupVotes.map((v) => [v.lawId, v.majorityPosition]));

	const details: VoteComparison[] = userVotes
		.filter((uv) => groupVoteMap.has(uv.lawId))
		.map((uv) => {
			const groupPosition = groupVoteMap.get(uv.lawId)!;
			return {
				lawId: uv.lawId,
				lawTitle: lawTitles.get(uv.lawId) || 'Loi inconnue',
				userPosition: uv.position,
				groupPosition,
				agreement: uv.position === groupPosition
			};
		});

	const agreements = details.filter((d) => d.agreement).length;
	const disagreements = details.length - agreements;

	return {
		groupId: groupInfo.id,
		groupName: groupInfo.name,
		groupShortName: groupInfo.shortName,
		score: details.length > 0 ? Math.round((agreements / details.length) * 100) : 0,
		agreements,
		disagreements,
		details
	};
}

/**
 * Trie les résultats d'alignement par score décroissant.
 *
 * @param results - Résultats d'alignement à trier
 * @returns Résultats triés (score descendant)
 */
export function sortAlignmentResults(results: AlignmentResult[]): AlignmentResult[] {
	return [...results].sort((a, b) => b.score - a.score);
}

/**
 * Extrait le podium (top 3) des résultats d'alignement.
 *
 * @param results - Résultats d'alignement triés
 * @returns Top 3 groupes
 */
export function getPodium(results: AlignmentResult[]): AlignmentResult[] {
	return results.slice(0, 3);
}
