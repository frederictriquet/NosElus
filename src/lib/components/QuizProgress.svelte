<script lang="ts">
	/**
	 * Barre de progression pour le quiz politique.
	 * Affiche la progression en pourcentage et nombre de lois votées.
	 */
	interface Props {
		current: number; // Index actuel (0-based)
		total: number; // Nombre total de lois
	}

	let { current = 0, total = 0 }: Props = $props();

	const progress = $derived(total > 0 ? Math.round(((current + 1) / total) * 100) : 0);
	const voteCount = $derived(current + 1);
</script>

<div class="quiz-progress">
	<div class="progress-header">
		<span class="progress-text"
			>Question {voteCount} sur {total}</span
		>
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
