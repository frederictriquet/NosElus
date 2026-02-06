/**
 * Store Svelte pour gérer l'état du quiz politique.
 *
 * Gère la progression, les votes utilisateur, et la persistence
 * via localStorage. Paramétrable par chambre via QuizChamberConfig.
 */

import { writable, derived, get } from 'svelte/store';
import type { UserVote } from '$lib/utils/alignment';
import type { QuizChamberConfig } from '$lib/quiz/config';
import { AN_QUIZ_CONFIG } from '$lib/quiz/config';

export interface QuizLaw {
	id: string;
	title: string;
	shortTitle: string | null;
	type: string;
	status: string | null;
	description: string | null;
	sourceUrl: string | null;
	summary: string;
	summaryModel: string | null;
	tags: { slug: string; name: string; color: string | null }[];
}

export interface QuizState {
	currentIndex: number;
	votes: UserVote[];
	laws: QuizLaw[];
	reserveLaws: QuizLaw[];
	abstainedLawIds: string[];
	sessionId: string;
	startedAt: Date | null;
	completedAt: Date | null;
}

/**
 * Crée un ensemble de stores (store principal + stores dérivés) pour un quiz.
 *
 * Chaque chambre (AN, PE) obtient ses propres stores avec
 * des clés localStorage distinctes.
 */
export function createChamberQuizStore(config: QuizChamberConfig) {
	const STORAGE_KEY = config.storageKey;
	const SESSION_KEY = config.sessionKey;

	const loadFromStorage = (): QuizState | null => {
		if (typeof window === 'undefined') return null;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (!stored) return null;

			const parsed = JSON.parse(stored);
			return {
				...parsed,
				reserveLaws: parsed.reserveLaws || [],
				abstainedLawIds: parsed.abstainedLawIds || [],
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
		reserveLaws: [],
		abstainedLawIds: [],
		sessionId: '',
		startedAt: null,
		completedAt: null
	};

	const { subscribe, set, update } = writable<QuizState>(initialState);

	const saveToStorage = (state: QuizState) => {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			localStorage.setItem(SESSION_KEY, state.sessionId);
		} catch (error) {
			console.error('Failed to save quiz state to localStorage:', error);
		}
	};

	const store = {
		subscribe,

		init: (laws: QuizLaw[], reserveLaws: QuizLaw[] = []) => {
			const newState: QuizState = {
				currentIndex: 0,
				votes: [],
				laws,
				reserveLaws,
				abstainedLawIds: [],
				sessionId: generateSessionId(),
				startedAt: new Date(),
				completedAt: null
			};
			set(newState);
			saveToStorage(newState);
		},

		vote: (position: 'pour' | 'contre') => {
			update((state) => {
				const currentLaw = state.laws[state.currentIndex];
				if (!currentLaw) return state;

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

		next: () => {
			update((state) => {
				const newIndex = Math.min(state.currentIndex + 1, state.laws.length - 1);
				const newState = { ...state, currentIndex: newIndex };
				saveToStorage(newState);
				return newState;
			});
		},

		previous: () => {
			update((state) => {
				const newIndex = Math.max(state.currentIndex - 1, 0);
				const newState = { ...state, currentIndex: newIndex };
				saveToStorage(newState);
				return newState;
			});
		},

		abstain: () => {
			update((state) => {
				const currentLaw = state.laws[state.currentIndex];
				if (!currentLaw || state.reserveLaws.length === 0) return state;

				const [replacement, ...remainingReserve] = state.reserveLaws;
				const newLaws = [...state.laws];
				newLaws[state.currentIndex] = replacement;

				const newVotes = state.votes.filter((v) => v.lawId !== currentLaw.id);

				const newState = {
					...state,
					laws: newLaws,
					reserveLaws: remainingReserve,
					abstainedLawIds: [...state.abstainedLawIds, currentLaw.id],
					votes: newVotes
				};
				saveToStorage(newState);
				return newState;
			});
		},

		complete: () => {
			update((state) => {
				const newState = { ...state, completedAt: new Date() };
				saveToStorage(newState);
				return newState;
			});
		},

		reset: () => {
			const newState: QuizState = {
				currentIndex: 0,
				votes: [],
				laws: [],
				reserveLaws: [],
				abstainedLawIds: [],
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

		get: () => get({ subscribe })
	};

	return {
		store,
		progress: derived(store, ($quiz) => {
			if ($quiz.laws.length === 0) return 0;
			return Math.round(($quiz.votes.length / $quiz.laws.length) * 100);
		}),
		completed: derived(store, ($quiz) => {
			return $quiz.votes.length === $quiz.laws.length && $quiz.laws.length > 0;
		}),
		canGoNext: derived(store, ($quiz) => {
			const currentLaw = $quiz.laws[$quiz.currentIndex];
			if (!currentLaw) return false;
			return $quiz.votes.some((v) => v.lawId === currentLaw.id);
		}),
		canGoPrevious: derived(store, ($quiz) => {
			return $quiz.currentIndex > 0;
		}),
		canAbstain: derived(store, ($quiz) => {
			return $quiz.reserveLaws.length > 0;
		}),
		reserveCount: derived(store, ($quiz) => {
			return $quiz.reserveLaws.length;
		})
	};
}

// Singleton AN pour rétro-compatibilité
const anQuiz = createChamberQuizStore(AN_QUIZ_CONFIG);
export const quizStore = anQuiz.store;
export const quizProgress = anQuiz.progress;
export const quizCompleted = anQuiz.completed;
export const canGoNext = anQuiz.canGoNext;
export const canGoPrevious = anQuiz.canGoPrevious;
export const canAbstain = anQuiz.canAbstain;
export const reserveCount = anQuiz.reserveCount;

function generateSessionId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function getSessionId(config: QuizChamberConfig = AN_QUIZ_CONFIG): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem(config.sessionKey);
}
