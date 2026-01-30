<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Titre du panel */
		title: string;
		/** Sous-titre optionnel */
		subtitle?: string;
		/** Promise à attendre */
		promise: Promise<T>;
		/** Contenu à afficher une fois chargé */
		children: Snippet<[data: T]>;
		/** Contenu de fallback en cas d'erreur */
		error?: Snippet<[error: Error]>;
		/** Hauteur minimale du skeleton (défaut: 200px) */
		minHeight?: string;
	}

	let {
		title,
		subtitle = undefined,
		promise,
		children,
		error: errorSlot = undefined,
		minHeight = '200px'
	}: Props = $props();
</script>

<section class="card">
	<h2>{title}</h2>
	{#if subtitle}
		<p class="subtitle">{subtitle}</p>
	{/if}

	{#await promise}
		<div class="loading-container" style="min-height: {minHeight}">
			<div class="spinner"></div>
			<span class="loading-text">Chargement...</span>
		</div>
	{:then data}
		{@render children(data)}
	{:catch err}
		{#if errorSlot}
			{@render errorSlot(err)}
		{:else}
			<div class="error-container">
				<span class="error-icon">⚠</span>
				<span class="error-text">Erreur de chargement</span>
			</div>
		{/if}
	{/await}
</section>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0 0 1rem;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: var(--color-text-muted);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		font-size: 0.875rem;
	}

	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		color: var(--color-danger);
	}

	.error-icon {
		font-size: 1.5rem;
	}

	.error-text {
		font-size: 0.875rem;
	}
</style>
