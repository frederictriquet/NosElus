<script lang="ts">
	/**
	 * Props du composant QuizProgress
	 *
	 * @interface Props
	 */
	interface Props {
		/** Index de la question actuelle (0-based) */
		current: number;
		/** Nombre total de questions dans le quiz */
		total: number;
	}

	let { current = 0, total = 0 }: Props = $props();

	const progress = $derived(total > 0 ? Math.round(((current + 1) / total) * 100) : 0);
	const voteCount = $derived(current + 1);
</script>

<!--
  QuizProgress - Barre de progression visuelle pour le quiz

  Affiche la progression du quiz en temps réel avec :
  - Numéro de question actuel (format "Question X sur Y")
  - Pourcentage de complétion
  - Barre de progression visuelle avec gradient

  @component
  @example
  ```svelte
  <QuizProgress current={4} total={10} />
  <!-- Affiche "Question 5 sur 10" + "50%" -->
``` -->

<div class="quiz-progress">
	<div class="progress-header">
		<span class="progress-text">Question {voteCount} sur {total}</span>
		<span class="progress-percent">{progress}%</span>
	</div>
	<div class="progress-bar">
		<div class="progress-fill" style="width: {progress}%"></div>
	</div>
</div>

<style>
	.quiz-progress {
		margin-bottom: 2rem;
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.progress-text {
		font-weight: 500;
		color: var(--color-text);
	}

	.progress-percent {
		font-weight: 600;
		color: var(--color-primary);
	}

	.progress-bar {
		height: 8px;
		background: var(--color-border);
		border-radius: 999px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--color-primary), var(--color-primary-dark));
		border-radius: 999px;
		transition: width 0.3s ease;
	}
</style>
