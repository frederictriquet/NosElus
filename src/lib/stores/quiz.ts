/**
 * Store Svelte pour gérer l'état du quiz politique.
 *
 * Gère la progression, les votes utilisateur, et la persistence
 * via localStorage.
 */

import { writable, derived, get } from 'svelte/store';
import type { UserVote } from '$lib/utils/alignment';

const STORAGE_KEY = 'noselus-quiz-votes';
const SESSION_KEY = 'noselus-quiz-session';

export interface QuizLaw {
	id: string;
	title: string;
	shortTitle: string | null;
	summary: string;
	tags: { slug: string; name: string; color: string | null }[];
}

export interface QuizState {
	currentIndex: number;
	votes: UserVote[];
	laws: QuizLaw[];
	sessionId: string;
	startedAt: Date | null;
	completedAt: Date | null;
}

/**
 * Crée le store du quiz avec persistence localStorage.
 */
function createQuizStore() {
	// Initialiser depuis localStorage si disponible
	const loadFromStorage = (): QuizState | null => {
		if (typeof window === 'undefined') return null;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (!stored) return null;

			const parsed = JSON.parse(stored);
			return {
				...parsed,
				startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
				completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null
			};
		} catch {
			return null;
		}
	};

	const initialState: QuizState = loadFromStorage() || {
		currentIndex: 0,
		votes: [],
		laws: [],
		sessionId: '',
		startedAt: null,
		completedAt: null
	};

	const { subscribe, set, update } = writable<QuizState>(initialState);

	// Sauvegarder dans localStorage à chaque changement
	const saveToStorage = (state: QuizState) => {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			localStorage.setItem(SESSION_KEY, state.sessionId);
		} catch (error) {
			console.error('Failed to save quiz state to localStorage:', error);
		}
	};

	return {
		subscribe,

		/**
		 * Initialise un nouveau quiz avec les lois fournies.
		 */
		init: (laws: QuizLaw[]) => {
			const newState: QuizState = {
				currentIndex: 0,
				votes: [],
				laws,
				sessionId: generateSessionId(),
				startedAt: new Date(),
				completedAt: null
			};
			set(newState);
			saveToStorage(newState);
		},

		/**
		 * Enregistre un vote pour la loi courante.
		 */
		vote: (position: 'pour' | 'contre') => {
			update((state) => {
				const currentLaw = state.laws[state.currentIndex];
				if (!currentLaw) return state;

				// Remplacer ou ajouter le vote
				const existingIndex = state.votes.findIndex((v) => v.lawId === currentLaw.id);
				const newVotes = [...state.votes];

				if (existingIndex >= 0) {
					newVotes[existingIndex] = { lawId: currentLaw.id, position };
				} else {
					newVotes.push({ lawId: currentLaw.id, position });
				}

				const newState = { ...state, votes: newVotes };
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Passe à la loi suivante.
		 */
		next: () => {
			update((state) => {
				const newIndex = Math.min(state.currentIndex + 1, state.laws.length - 1);
				const newState = { ...state, currentIndex: newIndex };
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Revient à la loi précédente.
		 */
		previous: () => {
			update((state) => {
				const newIndex = Math.max(state.currentIndex - 1, 0);
				const newState = { ...state, currentIndex: newIndex };
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Marque le quiz comme terminé.
		 */
		complete: () => {
			update((state) => {
				const newState = { ...state, completedAt: new Date() };
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Réinitialise complètement le quiz.
		 */
		reset: () => {
			const newState: QuizState = {
				currentIndex: 0,
				votes: [],
				laws: [],
				sessionId: '',
				startedAt: null,
				completedAt: null
			};
			set(newState);
			if (typeof window !== 'undefined') {
				localStorage.removeItem(STORAGE_KEY);
				localStorage.removeItem(SESSION_KEY);
			}
		},

		/**
		 * Récupère l'état actuel (utile côté serveur).
		 */
		get: () => get({ subscribe })
	};
}

export const quizStore = createQuizStore();

/**
 * Store dérivé : progression du quiz (%).
 */
export const quizProgress = derived(quizStore, ($quiz) => {
	if ($quiz.laws.length === 0) return 0;
	return Math.round(($quiz.votes.length / $quiz.laws.length) * 100);
});

/**
 * Store dérivé : quiz terminé ?
 */
export const quizCompleted = derived(quizStore, ($quiz) => {
	return $quiz.votes.length === $quiz.laws.length && $quiz.laws.length > 0;
});

/**
 * Store dérivé : peut aller à la suivante ?
 */
export const canGoNext = derived(quizStore, ($quiz) => {
	// Peut avancer si un vote existe pour la loi courante
	const currentLaw = $quiz.laws[$quiz.currentIndex];
	if (!currentLaw) return false;
	return $quiz.votes.some((v) => v.lawId === currentLaw.id);
});

/**
 * Store dérivé : peut revenir en arrière ?
 */
export const canGoPrevious = derived(quizStore, ($quiz) => {
	return $quiz.currentIndex > 0;
});

/**
 * Génère un ID de session unique.
 */
function generateSessionId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Récupère l'ID de session depuis localStorage (côté client).
 */
export function getSessionId(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem(SESSION_KEY);
}
