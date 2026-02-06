<script lang="ts">
	/**
	 * Composant partagé pour la page quiz (AN et PE).
	 *
	 * Reçoit la config chambre et les données serveur,
	 * gère le store quiz et l'ensemble du flux de questions.
	 */
	import { goto } from '$app/navigation';
	import { dev } from '$app/environment';
	import { onMount } from 'svelte';
	import { createChamberQuizStore, type QuizLaw } from '$lib/stores/quiz';
	import type { QuizChamberConfig } from '$lib/quiz/config';
	import QuizProgress from '$lib/components/QuizProgress.svelte';
	import QuizSetup from '$lib/components/QuizSetup.svelte';
	import LawDossierCard from '$lib/components/LawDossierCard.svelte';
	import { sortByPoliticalPosition } from '$lib/utils/political-spectrum';
	import { selectQuizLaws } from '$lib/utils/quiz-selection';

	interface Props {
		config: QuizChamberConfig;
		allLaws: QuizLaw[];
		availableTags: { slug: string; name: string; color: string | null; lawCount: number }[];
	}

	let { config, allLaws, availableTags }: Props = $props();

	// Créer le store pour cette chambre
	const quiz = createChamberQuizStore(config);
	const { store: quizStore, canGoNext, canGoPrevious, completed: quizCompleted, canAbstain, reserveCount } = quiz;

	// Phase : 'setup' (configuration) ou 'quiz' (questions)
	let phase = $state<'setup' | 'quiz'>('setup');
	let initialized = $state(false);

	// Lois sélectionnées pour le quiz en cours
	let quizLawCount = $state(0);

	// Vérifier si un quiz est en cours au montage
	onMount(() => {
		const stored = localStorage.getItem(config.storageKey);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				if (parsed.laws?.length > 0 && !parsed.completedAt) {
					phase = 'quiz';
					quizLawCount = parsed.laws.length;
					initialized = true;
					loadDebugData(parsed.laws.map((l: { id: string }) => l.id));
					return;
				}
			} catch {
				// localStorage corrompu, on l'ignore
			}
		}
	});

	// Démarrer un nouveau quiz depuis la page de configuration
	function handleStart(selectedTags: Set<string>, quizSize: number) {
		const { quizLaws, reserveLaws } = selectQuizLaws(allLaws, selectedTags, quizSize);
		quizStore.init(quizLaws, reserveLaws);
		quizLawCount = quizLaws.length;
		initialized = true;
		phase = 'quiz';

		if (dev) {
			const allLawIds = [...quizLaws, ...reserveLaws].map((l) => l.id);
			loadDebugData(allLawIds);
		}
	}

	// Réactivité sur le store
	let currentIndex = $state(0);
	let currentVote = $state<'pour' | 'contre' | null>(null);
	let laws = $state<QuizLaw[]>([]);
	let canNext = $state(false);
	let canPrevious = $state(false);
	let isCompleted = $state(false);
	let abstainAllowed = $state(false);
	let remainingReserve = $state(0);

	// Debug : votes des groupes (dev uniquement)
	type DebugGroup = {
		id: string;
		name: string;
		shortName: string | null;
		politicalPosition: number | null;
	};
	type DebugLawVote = { majorityPosition: 'pour' | 'contre'; pour: number; contre: number };
	type DebugGroupVotes = Record<string, Record<string, DebugLawVote>>;
	let debugGroups = $state<DebugGroup[]>([]);
	let debugGroupVotes = $state<DebugGroupVotes>({});
	let debugSortMode = $state<'vote' | 'spectrum'>('vote');

	async function loadDebugData(lawIds: string[]) {
		if (!dev) return;
		try {
			const res = await fetch('/api/quiz/group-votes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lawIds, legislature: config.legislature })
			});
			if (res.ok) {
				const { groupVotes, groups } = await res.json();
				debugGroupVotes = groupVotes;
				debugGroups = groups;
			}
		} catch {
			// silently ignore debug data fetch errors
		}
	}

	const debugCurrentLawVotes = $derived.by(() => {
		const law = laws[currentIndex];
		if (!law || debugGroups.length === 0) return [];

		const withVotes = debugGroups
			.map((g) => {
				const vote = debugGroupVotes[g.id]?.[law.id];
				return {
					...g,
					shortName: g.shortName || g.name,
					position: vote?.majorityPosition ?? null,
					pour: vote?.pour ?? 0,
					contre: vote?.contre ?? 0
				};
			})
			.filter((g) => g.position !== null);

		if (debugSortMode === 'spectrum') {
			return sortByPoliticalPosition(withVotes);
		}
		return withVotes.sort((a, b) => {
			const ratioA = a.pour + a.contre > 0 ? a.pour / (a.pour + a.contre) : 0;
			const ratioB = b.pour + b.contre > 0 ? b.pour / (b.pour + b.contre) : 0;
			if (ratioA !== ratioB) return ratioB - ratioA;
			return b.pour + b.contre - (a.pour + a.contre);
		});
	});

	// Synchroniser avec le store
	$effect(() => {
		const state = $quizStore;
		currentIndex = state.currentIndex;
		laws = state.laws;

		const currentLaw = state.laws[state.currentIndex];
		if (currentLaw) {
			const vote = state.votes.find((v) => v.lawId === currentLaw.id);
			currentVote = vote?.position ?? null;
		}
	});

	$effect(() => {
		canNext = $canGoNext;
		canPrevious = $canGoPrevious;
		isCompleted = $quizCompleted;
		abstainAllowed = $canAbstain;
		remainingReserve = $reserveCount;
	});

	// Redirection automatique vers résultats si quiz terminé
	$effect(() => {
		if (isCompleted && initialized) {
			quizStore.complete();
			goto(config.resultsPath);
		}
	});

	const handleVote = (position: 'pour' | 'contre') => {
		quizStore.vote(position);
	};

	const handleAbstain = () => {
		quizStore.abstain();
	};

	const handleNext = () => {
		if (canNext) {
			quizStore.next();
		}
	};

	const handlePrevious = () => {
		if (canPrevious) {
			quizStore.previous();
		}
	};

	const currentLaw = $derived(laws[currentIndex]);
</script>

{#if allLaws.length === 0}
	<div class="card">
		<p class="error-message">Aucune loi disponible pour le quiz. Veuillez réessayer plus tard.</p>
	</div>
{:else if phase === 'setup'}
	<QuizSetup {availableTags} {allLaws} onStart={handleStart} />
{:else}
	<div class="quiz-container">
		<QuizProgress current={currentIndex} total={quizLawCount} />

		{#if currentLaw}
			<div class="vote-panel">
				<div class="vote-buttons">
					<button
						class="vote-btn vote-pour"
						class:selected={currentVote === 'pour'}
						onclick={() => handleVote('pour')}
						type="button"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
						<span>Pour</span>
					</button>

					<button
						class="vote-btn vote-contre"
						class:selected={currentVote === 'contre'}
						onclick={() => handleVote('contre')}
						type="button"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="18" x2="6" y1="6" y2="18" />
							<line x1="6" x2="18" y1="6" y2="18" />
						</svg>
						<span>Contre</span>
					</button>
				</div>

				<div class="navigation-buttons">
					<button
						class="nav-btn btn-secondary"
						disabled={!canPrevious}
						onclick={handlePrevious}
						type="button"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="15 18 9 12 15 6" />
						</svg>
						<span>Précédent</span>
					</button>

					<button
						class="abstain-btn"
						disabled={!abstainAllowed}
						onclick={handleAbstain}
						type="button"
					>
						<span>Passer cette question</span>
						{#if remainingReserve > 0}
							<span class="reserve-badge"
								>{remainingReserve} restante{remainingReserve > 1 ? 's' : ''}</span
							>
						{/if}
					</button>

					<button
						class="nav-btn btn-primary"
						disabled={!canNext}
						onclick={handleNext}
						type="button"
					>
						<span>{currentIndex === quizLawCount - 1 ? 'Voir les résultats' : 'Suivant'}</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</div>
			</div>

			<LawDossierCard law={currentLaw} showDisclaimer={false} />
		{/if}

		{#if dev && debugCurrentLawVotes.length > 0}
			<details class="debug-panel">
				<summary class="debug-toggle">DEBUG : votes des groupes</summary>
				<div class="debug-content">
					<div class="debug-sort-controls">
						<span class="debug-sort-label">Tri :</span>
						<button
							class="debug-sort-btn"
							class:active={debugSortMode === 'vote'}
							onclick={() => (debugSortMode = 'vote')}
							type="button">Pour / Contre</button
						>
						<button
							class="debug-sort-btn"
							class:active={debugSortMode === 'spectrum'}
							onclick={() => (debugSortMode = 'spectrum')}
							type="button">Gauche → Droite</button
						>
					</div>
					<div class="debug-grid">
						{#each debugCurrentLawVotes as g}
							<span
								class="debug-group"
								class:debug-pour={g.position === 'pour'}
								class:debug-contre={g.position === 'contre'}
							>
								<span class="debug-group-name">{g.shortName}</span>
								<span class="debug-group-counts">{g.pour}↑ {g.contre}↓</span>
							</span>
						{/each}
					</div>
				</div>
			</details>
		{/if}

		<div class="quiz-info">
			<p class="info-text">
				💡 <strong>Comment ça marche ?</strong> Votez "pour" ou "contre" chaque loi, ou passez la question
				pour obtenir une autre loi. À la fin, nous comparerons vos votes avec ceux des groupes parlementaires
				pour calculer votre alignement politique.
			</p>
			<p class="info-text disclaimer">
				ℹ️ Ce quiz est indicatif et basé sur un échantillon de {quizLawCount} lois de la {config.periodLabel}.
				Il ne remplace pas une analyse politique approfondie.
			</p>
		</div>
	</div>
{/if}

<style>
	.quiz-container {
		max-width: 800px;
		margin: 0 auto;
	}

	.vote-panel {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow);
	}

	.vote-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.vote-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.25rem;
		border: 2px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		cursor: pointer;
		transition: all 0.2s;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.vote-btn:hover {
		border-color: var(--color-primary);
		transform: translateY(-2px);
		box-shadow: var(--shadow-sm);
	}

	.vote-btn svg {
		width: 32px;
		height: 32px;
	}

	.vote-pour {
		color: #10b981;
	}

	.vote-pour:hover {
		background: #10b98110;
		border-color: #10b981;
	}

	.vote-pour.selected {
		background: #10b981;
		border-color: #10b981;
		color: white;
	}

	.vote-contre {
		color: #ef4444;
	}

	.vote-contre:hover {
		background: #ef444410;
		border-color: #ef4444;
	}

	.vote-contre.selected {
		background: #ef4444;
		border-color: #ef4444;
		color: white;
	}

	.abstain-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.8125rem;
		transition: all 0.2s;
	}

	.abstain-btn:hover:not(:disabled) {
		border-color: var(--color-text-muted);
		background: var(--color-bg);
	}

	.abstain-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.reserve-badge {
		font-size: 0.6875rem;
		padding: 0.0625rem 0.375rem;
		background: var(--color-bg);
		border-radius: 999px;
		color: var(--color-text-muted);
	}

	.navigation-buttons {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.nav-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		border: 2px solid;
	}

	.btn-secondary {
		background: var(--color-surface);
		border-color: var(--color-border);
		color: var(--color-text);
	}

	.btn-secondary:hover:not(:disabled) {
		border-color: var(--color-primary);
		transform: translateY(-2px);
	}

	.btn-primary {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-dark);
		transform: translateY(-2px);
	}

	.nav-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.quiz-info {
		margin-top: 3rem;
		padding: 1.5rem;
		background: var(--color-bg);
		border-radius: var(--radius);
	}

	.info-text {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-text);
	}

	.info-text:last-child {
		margin-bottom: 0;
	}

	.disclaimer {
		font-style: italic;
		color: var(--color-text-muted);
	}

	.error-message {
		text-align: center;
		color: var(--color-text-muted);
		padding: 2rem;
	}

	/* Debug panel (dev only) */
	.debug-panel {
		margin-top: 1.5rem;
		border: 1px dashed #f59e0b;
		border-radius: var(--radius);
		background: #fefce8;
		font-size: 0.75rem;
	}

	.debug-toggle {
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		font-weight: 600;
		color: #92400e;
		list-style: none;
	}

	.debug-toggle::-webkit-details-marker {
		display: none;
	}

	.debug-content {
		padding: 0.5rem 0.75rem 0.75rem;
		border-top: 1px dashed #f59e0b;
	}

	.debug-sort-controls {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.debug-sort-label {
		font-weight: 600;
		color: #92400e;
	}

	.debug-sort-btn {
		padding: 0.125rem 0.5rem;
		border: 1px solid #f59e0b;
		border-radius: var(--radius-sm);
		background: transparent;
		color: #92400e;
		cursor: pointer;
		font-size: 0.75rem;
	}

	.debug-sort-btn.active {
		background: #f59e0b;
		color: white;
	}

	.debug-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.debug-group {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-family: var(--font-mono);
	}

	.debug-group-counts {
		opacity: 0.7;
		font-size: 0.625rem;
	}

	.debug-pour {
		background: #d1fae5;
		color: #065f46;
	}

	.debug-contre {
		background: #fee2e2;
		color: #991b1b;
	}

	@media (max-width: 640px) {
		.vote-buttons {
			gap: 0.75rem;
		}

		.vote-btn {
			padding: 1rem;
			font-size: 0.875rem;
		}

		.vote-btn svg {
			width: 24px;
			height: 24px;
		}

		.navigation-buttons {
			flex-direction: column;
		}

		.nav-btn {
			width: 100%;
			justify-content: center;
		}

		.btn-primary {
			order: 1;
		}

		.abstain-btn {
			order: 2;
		}

		.btn-secondary {
			order: 3;
		}
	}
</style>
