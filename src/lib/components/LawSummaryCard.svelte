<script lang="ts">
	interface Props {
		/** Résumé de la loi généré par IA */
		summary: string;
		/** Tags de catégorisation */
		tags: string[];
		/** Modèle utilisé pour l'analyse */
		model?: string;
		/** Afficher le badge "IA" */
		showAiBadge?: boolean;
		/** Classes CSS additionnelles */
		class?: string;
	}

	let {
		summary,
		tags,
		model = undefined,
		showAiBadge = true,
		class: className = ''
	}: Props = $props();

	// Couleurs par catégorie de tag
	const tagColors: Record<string, string> = {
		économie: '#3b82f6',
		fiscalité: '#3b82f6',
		environnement: '#22c55e',
		énergie: '#22c55e',
		agriculture: '#22c55e',
		santé: '#ef4444',
		travail: '#f59e0b',
		social: '#f59e0b',
		justice: '#8b5cf6',
		sécurité: '#8b5cf6',
		éducation: '#06b6d4',
		recherche: '#06b6d4',
		culture: '#ec4899',
		défense: '#64748b',
		immigration: '#64748b',
		international: '#64748b',
		transports: '#14b8a6',
		logement: '#f97316',
		numérique: '#6366f1',
		collectivités: '#a855f7'
	};

	function getTagColor(tag: string): string {
		return tagColors[tag.toLowerCase()] || '#6b7280';
	}
</script>

<div class="law-summary {className}">
	{#if showAiBadge}
		<div class="ai-header">
			<div class="ai-badge" title={model ? `Généré par ${model}` : 'Généré par IA'}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
					<circle cx="7.5" cy="14.5" r="1.5"/>
					<circle cx="16.5" cy="14.5" r="1.5"/>
				</svg>
				<span>Résumé IA</span>
			</div>
			<span class="ai-disclaimer">Ce résumé peut contenir des erreurs. Consultez le texte complet pour plus de certitude.</span>
		</div>
	{/if}

	<p class="summary-text">{summary}</p>

	{#if tags.length > 0}
		<div class="tags">
			{#each tags as tag}
				<span class="tag" style="--tag-color: {getTagColor(tag)}">
					{tag}
				</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.law-summary {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		border-left: 3px solid var(--color-primary);
	}

	.ai-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}

	.ai-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.ai-badge svg {
		opacity: 0.7;
	}

	.ai-disclaimer {
		font-size: 0.75rem;
		font-style: italic;
		color: var(--color-text-muted);
		opacity: 0.8;
	}

	.summary-text {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--color-text);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.625rem;
		font-size: 0.75rem;
		font-weight: 500;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--tag-color) 15%, transparent);
		color: var(--tag-color);
		border: 1px solid color-mix(in srgb, var(--tag-color) 30%, transparent);
	}

	/* Dark mode adjustments */
	:global(.dark) .tag {
		background: color-mix(in srgb, var(--tag-color) 20%, transparent);
	}
</style>
