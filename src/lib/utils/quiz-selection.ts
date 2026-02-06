/**
 * Utilitaires de sélection et stratification des lois pour le quiz politique.
 *
 * Ce module fournit la logique métier côté client pour :
 * - Filtrer les lois selon les tags sélectionnés par l'utilisateur
 * - Stratifier la sélection pour représenter équitablement chaque thème
 * - Calculer les tailles de quiz disponibles selon le nombre de lois
 *
 * @module quiz-selection
 * @see {@link QuizSetup} Composant qui utilise ces fonctions
 */

import type { QuizLaw } from '$lib/stores/quiz';

/**
 * Résultat de la sélection de lois pour le quiz
 *
 * @interface SelectionResult
 */
export interface SelectionResult {
	/** Lois sélectionnées pour les questions du quiz */
	quizLaws: QuizLaw[];
	/** Lois de réserve pour remplacer les questions passées */
	reserveLaws: QuizLaw[];
}

/**
 * Mélange un tableau avec l'algorithme Fisher-Yates (distribution uniforme).
 *
 * Contrairement à `array.sort(() => Math.random() - 0.5)` qui n'est pas uniformément
 * distribué, Fisher-Yates garantit que chaque permutation a la même probabilité.
 *
 * @param array - Tableau à mélanger (n'est pas modifié)
 * @returns Nouveau tableau avec les éléments mélangés
 *
 * @example
 * ```typescript
 * const shuffled = shuffle([1, 2, 3, 4, 5]);
 * // => [3, 1, 5, 2, 4] (ordre aléatoire)
 * ```
 *
 * @internal
 */
function shuffle<T>(array: T[]): T[] {
	const a = [...array];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/**
 * Sélectionne les lois du quiz avec stratification par tags.
 *
 * Algorithme :
 * 1. Filtre les lois ayant au moins un tag sélectionné (logique OR)
 * 2. Groupe les lois par tag principal (premier tag parmi ceux sélectionnés)
 * 3. Échantillonne équitablement dans chaque groupe (ceil(quizSize / nbTags) par tag)
 * 4. Mélange l'ensemble avec Fisher-Yates
 * 5. Sépare en quiz (N premières) et réserve (reste)
 *
 * @param allLaws - Liste complète des lois disponibles
 * @param selectedTagSlugs - Set des slugs de tags sélectionnés par l'utilisateur
 * @param quizSize - Nombre de questions souhaitées pour le quiz
 * @returns Objet avec quizLaws (questions) et reserveLaws (réserve)
 *
 * @example
 * ```typescript
 * const laws = [
 *   { id: 'L1', tags: [{ slug: 'economie', ... }], ... },
 *   { id: 'L2', tags: [{ slug: 'sante', ... }], ... },
 *   { id: 'L3', tags: [{ slug: 'economie', ... }], ... },
 * ];
 * const selectedTags = new Set(['economie', 'sante']);
 *
 * const { quizLaws, reserveLaws } = selectQuizLaws(laws, selectedTags, 2);
 * // => quizLaws: 2 lois (1 economie, 1 sante)
 * // => reserveLaws: 1 loi restante
 * ```
 *
 * @see {@link getAvailableQuizSizes} pour calculer les tailles valides
 */
export function selectQuizLaws(
	allLaws: QuizLaw[],
	selectedTagSlugs: Set<string>,
	quizSize: number
): SelectionResult {
	// Filtrer les lois qui ont au moins un tag sélectionné
	const filtered = allLaws.filter((law) => law.tags.some((t) => selectedTagSlugs.has(t.slug)));

	if (filtered.length === 0) {
		return { quizLaws: [], reserveLaws: [] };
	}

	// Grouper par tag principal (premier tag parmi les sélectionnés)
	const lawsByTag = new Map<string, QuizLaw[]>();
	for (const law of filtered) {
		const primaryTag = law.tags.find((t) => selectedTagSlugs.has(t.slug));
		if (primaryTag) {
			const key = primaryTag.slug;
			if (!lawsByTag.has(key)) {
				lawsByTag.set(key, []);
			}
			lawsByTag.get(key)!.push(law);
		}
	}

	// Stratifier : prendre équitablement de chaque tag
	const selectedLaws: QuizLaw[] = [];
	const tagGroups = Array.from(lawsByTag.values());
	const lawsPerTag = Math.ceil(quizSize / tagGroups.length);

	for (const tagLaws of tagGroups) {
		const shuffled = shuffle(tagLaws);
		selectedLaws.push(...shuffled.slice(0, lawsPerTag));
	}

	// Mélanger
	const allShuffled = shuffle(selectedLaws);

	// Ajouter les lois non sélectionnées comme réserve
	const selectedIds = new Set(allShuffled.map((l) => l.id));
	const remaining = filtered.filter((l) => !selectedIds.has(l.id));
	const allOrdered = [...allShuffled, ...shuffle(remaining)];

	return {
		quizLaws: allOrdered.slice(0, quizSize),
		reserveLaws: allOrdered.slice(quizSize)
	};
}

/**
 * Tailles de quiz standard proposées à l'utilisateur.
 *
 * Ces valeurs correspondent aux boutons affichés dans l'interface de configuration.
 * Les tailles sont filtrées dynamiquement selon le nombre de lois disponibles.
 *
 * @constant
 */
const QUIZ_SIZES = [5, 10, 15, 20];

/**
 * Retourne les tailles de quiz valides pour un nombre de lois donné.
 *
 * Filtre les tailles standard pour ne garder que celles inférieures ou égales
 * au nombre de lois disponibles. Si aucune taille standard n'est valide,
 * retourne le nombre de lois disponibles comme seule option.
 *
 * @param lawCount - Nombre de lois disponibles après filtrage par tags
 * @returns Tableau des tailles de quiz valides (toujours au moins une option si lawCount > 0)
 *
 * @example
 * ```typescript
 * getAvailableQuizSizes(25);
 * // => [5, 10, 15, 20] (toutes les tailles disponibles)
 *
 * getAvailableQuizSizes(12);
 * // => [5, 10] (20 et 15 dépassent le nombre de lois)
 *
 * getAvailableQuizSizes(3);
 * // => [3] (aucune taille standard ne convient, retourne lawCount)
 *
 * getAvailableQuizSizes(0);
 * // => [] (aucune loi disponible)
 * ```
 *
 * @see {@link QUIZ_SIZES} pour les tailles standard
 */
export function getAvailableQuizSizes(lawCount: number): number[] {
	const valid = QUIZ_SIZES.filter((s) => s <= lawCount);
	if (valid.length === 0 && lawCount > 0) {
		return [lawCount];
	}
	return valid;
}
