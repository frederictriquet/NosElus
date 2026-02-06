<script lang="ts">
	/**
	 * Carte affichant une loi avec résumé et boutons pour voter pour/contre.
	 * Composant principal du quiz politique.
	 */
	import type { QuizLaw } from '$lib/stores/quiz';

	interface Props {
		law: QuizLaw;
		currentVote?: 'pour' | 'contre' | null;
		onVote: (position: 'pour' | 'contre') => void;
	}

	let { law, currentVote = null, onVote }: Props = $props();
</script>

<article class="quiz-law-card">
	<div class="law-header">
		<h2 class="law-title">{law.shortTitle || law.title}</h2>
		{#if law.tags && law.tags.length > 0}
			<div class="law-tags">
				{#each law.tags as tag}
					<span class="tag" style="background-color: {tag.color || '#6b7280'}20; color: {tag.color || '#6b7280'}">
						{tag.name}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<div class="law-summary">
		<p>{law.summary}</p>
	</div>

	<div class="vote-buttons">
		<button
			class="vote-btn vote-pour"
			class:selected={currentVote === 'pour'}
			onclick={() => onVote('pour')}
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
			onclick={() => onVote('contre')}
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
</article>

<style>
	.quiz-law-card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 2rem;
		box-shadow: var(--shadow);
	}

	.law-header {
		margin-bottom: 1.5rem;
	}

	.law-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		line-height: 1.4;
		color: var(--color-text);
	}

	.law-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag {
		font-size: 0.75rem;
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		font-weight: 500;
	}

	.law-summary {
		margin-bottom: 2rem;
		padding: 1.25rem;
		background: var(--color-bg);
		border-radius: var(--radius);
		border-left: 3px solid var(--color-primary);
	}

	.law-summary p {
		margin: 0;
		line-height: 1.6;
		color: var(--color-text);
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

	@media (max-width: 640px) {
		.quiz-law-card {
			padding: 1.5rem;
		}

		.law-title {
			font-size: 1.125rem;
		}

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
	}
</style>
