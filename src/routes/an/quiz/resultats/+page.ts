import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { scrutins, organs } from '$lib/server/db/schema';
import { inArray, eq, and, sql } from 'drizzle-orm';
import {
	calculateDetailedAlignment,
	sortAlignmentResults,
	type UserVote,
	type GroupVote,
	type AlignmentResult
} from '$lib/utils/alignment';
import { getSessionId } from '$lib/stores/quiz';

/**
 * Calcule l'alignement politique à partir des votes utilisateur
 * stockés dans localStorage.
 *
 * 1. Récupère les votes utilisateur depuis localStorage
 * 2. Pour chaque groupe parlementaire, récupère leurs votes majoritaires
 * 3. Calcule le score d'alignement (similarité Jaccard)
 * 4. Trie les résultats par score décroissant
 */
export const load: PageLoad = async ({ fetch }) => {
	// Vérifier qu'on est côté client
	if (typeof window === 'undefined') {
		throw error(400, 'Cette page nécessite JavaScript');
	}

	// Récupérer les votes depuis localStorage
	const storedVotes = localStorage.getItem('noselus-quiz-votes');
	if (!storedVotes) {
		throw error(404, {
			message: 'Aucun quiz en cours. Veuillez d\'abord répondre au quiz.'
		});
	}

	let quizState: {
		votes: UserVote[];
		laws: Array<{ id: string; title: string; shortTitle: string | null }>;
	};

	try {
		quizState = JSON.parse(storedVotes);
	} catch {
		throw error(500, 'Impossible de charger les votes');
	}

	if (!quizState.votes || quizState.votes.length === 0) {
		throw error(404, {
			message: 'Aucun vote enregistré. Veuillez répondre au quiz.'
		});
	}

	const userVotes = quizState.votes;
	const laws = quizState.laws;
	const lawIds = userVotes.map((v) => v.lawId);

	// Récupérer les titres des lois pour le détail
	const lawTitles = new Map(
		laws.map((law) => [law.id, law.shortTitle || law.title])
	);

	// Récupérer les votes des groupes pour les lois du quiz
	// Utiliser l'API côté client pour éviter problèmes SSR
	const response = await fetch('/api/quiz/group-votes', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ lawIds })
	});

	if (!response.ok) {
		throw error(500, 'Erreur lors du calcul de l\'alignement');
	}

	const { groupVotes, groups } = await response.json();

	// Calculer l'alignement pour chaque groupe
	const alignmentResults: AlignmentResult[] = [];

	for (const group of groups) {
		const groupVotesForLaws: GroupVote[] = lawIds
			.map((lawId) => {
				const vote = groupVotes[group.id]?.[lawId];
				if (!vote) return null;

				return {
					lawId,
					majorityPosition: vote.majorityPosition
				};
			})
			.filter((v): v is GroupVote => v !== null);

		if (groupVotesForLaws.length > 0) {
			const result = calculateDetailedAlignment(
				userVotes,
				groupVotesForLaws,
				{
					id: group.id,
					name: group.name,
					shortName: group.shortName
				},
				lawTitles
			);

			alignmentResults.push(result);
		}
	}

	// Trier par score décroissant
	const sortedResults = sortAlignmentResults(alignmentResults);

	return {
		results: sortedResults,
		userVotes,
		sessionId: getSessionId()
	};
};
