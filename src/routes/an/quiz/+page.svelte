<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { quizStore, canGoNext, canGoPrevious, quizCompleted } from '$lib/stores/quiz';
	import QuizProgress from '$lib/components/QuizProgress.svelte';
	import QuizLawCard from '$lib/components/QuizLawCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// État local
	let initialized = $state(false);

	// Initialiser le quiz au montage
	onMount(() => {
		if (data.laws.length > 0) {
			quizStore.init(data.laws);
			initialized = true;
		}
	});

	// Réactivité sur le store
	let currentIndex = $state(0);
	let currentVote = $state<'pour' | 'contre' | null>(null);
	let laws = $state(data.laws);
	let canNext = $state(false);
	let canPrevious = $state(false);
	let completed = $state(false);

	// Synchroniser avec le store
	$effect(() => {
		const state = $quizStore;
		currentIndex = state.currentIndex;
		laws = state.laws;

		// Trouver le vote actuel
		const currentLaw = state.laws[state.currentIndex];
		if (currentLaw) {
			const vote = state.votes.find((v) => v.lawId === currentLaw.id);
			currentVote = vote?.position || null;
		}
	});

	$effect(() => {
		canNext = $canGoNext;
		canPrevious = $canGoPrevious;
		completed = $quizCompleted;
	});

	// Redirection automatique vers résultats si quiz terminé
	$effect(() => {
		if (completed && initialized) {
			quizStore.complete();
			goto('/an/quiz/resultats');
		}
	});

	const handleVote = (position: 'pour' | 'contre') => {
		quizStore.vote(position);
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

<svelte:head>
	<title>Quiz Politique - NosÉlus</title>
	<meta
		name="description"
		content="Découvrez votre alignement politique en votant sur de vraies lois de l'Assemblée nationale"
	/>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Quiz Politique</h1>
	<p class="page-subtitle">
		Votez sur {data.laws.length} lois réelles et découvrez votre alignement avec les groupes parlementaires
	</p>
</div>

{#if !initialized || data.laws.length === 0}
	<div class="card">
		<p class="error-message">
			Aucune loi disponible pour le quiz. Veuillez réessayer plus tard.
		</p>
	</div>
{:else}
	<div class="quiz-container">
		<QuizProgress current={currentIndex} total={data.laws.length} />

		{#if currentLaw}
			<QuizLawCard law={currentLaw} {currentVote} onVote={handleVote} />

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
					class="nav-btn btn-primary"
					disabled={!canNext}
					onclick={handleNext}
					type="button"
				>
					<span>{currentIndex === data.laws.length - 1 ? 'Voir les résultats' : 'Suivant'}</span>
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
		{/if}

		<div class="quiz-info">
			<p class="info-text">
				💡 <strong>Comment ça marche ?</strong> Votez "pour" ou "contre" chaque loi. À la fin, nous
				comparerons vos votes avec ceux des groupes parlementaires pour calculer votre alignement politique.
			</p>
			<p class="info-text disclaimer">
				ℹ️ Ce quiz est indicatif et basé sur un échantillon de {data.laws.length} lois de la législature
				17. Il ne remplace pas une analyse politique approfondie.
			</p>
		</div>
	</div>
{/if}

<style>
	.quiz-container {
		max-width: 800px;
		margin: 0 auto;
	}

	.navigation-buttons {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 2rem;
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

	@media (max-width: 640px) {
		.navigation-buttons {
			flex-direction: column;
		}

		.nav-btn {
			width: 100%;
			justify-content: center;
		}

		.btn-secondary {
			order: 2;
		}

		.btn-primary {
			order: 1;
		}
	}
</style>
