<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();

	let searchInput = $state(data.query || '');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Debounced search
	$effect(() => {
		const query = searchInput;
		const currentQuery = data.query;

		if (query === currentQuery) return;

		if (debounceTimer) clearTimeout(debounceTimer);

		debounceTimer = setTimeout(() => {
			if (query.length >= 2) {
				const params = new URLSearchParams();
				params.set('q', query);
				goto(`/recherche?${params.toString()}`, { keepFocus: true });
			} else if (query.length === 0) {
				goto('/recherche', { keepFocus: true });
			}
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	function handleSearch(e: Event) {
		e.preventDefault();
		if (debounceTimer) clearTimeout(debounceTimer);
		if (searchInput.length >= 2) {
			const params = new URLSearchParams();
			params.set('q', searchInput);
			goto(`/recherche?${params.toString()}`);
		}
	}

	function getChamberLabel(chamber: string | null): string {
		switch (chamber) {
			case 'AN':
				return 'Député';
			case 'SENAT':
				return 'Sénateur';
			case 'PE':
				return 'Eurodéputé';
			default:
				return 'Élu';
		}
	}

	function getChamberRoute(chamber: string | null): string {
		switch (chamber) {
			case 'AN':
				return 'deputes';
			case 'SENAT':
				return 'senateurs';
			case 'PE':
				return 'eurodeputes';
			default:
				return 'deputes';
		}
	}

	function getElectedType(chamber: string | null): 'depute' | 'senateur' | 'eurodepute' {
		switch (chamber) {
			case 'SENAT':
				return 'senateur';
			case 'PE':
				return 'eurodepute';
			default:
				return 'depute';
		}
	}

	function getLegislatureLabel(legislature: string | null): string {
		if (!legislature) return '';
		if (legislature.startsWith('PE-')) return 'Parlement européen';
		return `${legislature}e législature`;
	}
</script>

<svelte:head>
	<title>Recherche{data.query ? ` - ${data.query}` : ''} - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Recherche</h1>
	<p class="page-subtitle">Recherchez parmi tous les élus français</p>
</div>

<div class="search-container">
	<form onsubmit={handleSearch} class="search-form">
		<input
			type="text"
			class="input search-input"
			placeholder="Rechercher un élu, un groupe, un scrutin..."
			bind:value={searchInput}
		/>
		<button type="submit" class="btn btn-primary">Rechercher</button>
	</form>
</div>

{#if data.results}
	<div class="results-summary">
		<span class="results-count">{data.results.total} résultat{data.results.total > 1 ? 's' : ''}</span>
		pour « <strong>{data.query}</strong> »
	</div>

	{#if data.results.actors.length > 0}
		<section class="results-section">
			<h2>
				Élus
				<span class="section-count">({data.results.actors.length})</span>
			</h2>
			<div class="card-grid">
				{#each data.results.actors as actor}
					<ElectedCard
						id={actor.id}
						name={actor.fullName}
						photoUrl={actor.photoUrl}
						group={actor.group}
						subtitle={getChamberLabel(actor.chamber)}
						type={getElectedType(actor.chamber)}
					/>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.results.groups.length > 0}
		<section class="results-section">
			<h2>
				Groupes politiques
				<span class="section-count">({data.results.groups.length})</span>
			</h2>
			<div class="groups-list">
				{#each data.results.groups as group}
					<a href="/groupes/{group.id}" class="group-item">
						<span class="group-dot" style="background: {group.color || '#888'}"></span>
						<div class="group-info">
							<span class="group-name">{group.name}</span>
							{#if group.shortName}
								<span class="group-short">({group.shortName})</span>
							{/if}
						</div>
						<span class="group-chamber">{getChamberLabel(group.chamber)}</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.results.scrutins.length > 0}
		<section class="results-section">
			<h2>
				Scrutins
				<span class="section-count">({data.results.scrutins.length})</span>
			</h2>
			<div class="scrutins-list">
				{#each data.results.scrutins as scrutin}
					<a href="/scrutins/{scrutin.id}" class="scrutin-item">
						<div class="scrutin-info">
							<span class="scrutin-title">
								{scrutin.title.slice(0, 100)}{scrutin.title.length > 100 ? '...' : ''}
							</span>
							<div class="scrutin-meta">
								{#if scrutin.date}
									<span>{new Date(scrutin.date).toLocaleDateString('fr-FR')}</span>
								{/if}
								{#if scrutin.legislature}
									<span class="scrutin-leg">{getLegislatureLabel(scrutin.legislature)}</span>
								{/if}
							</div>
						</div>
						{#if scrutin.result}
							<span
								class="scrutin-result"
								class:adopte={scrutin.result === 'adopté'}
								class:rejete={scrutin.result === 'rejeté'}
							>
								{scrutin.result}
							</span>
						{/if}
					</a>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.results.total === 0}
		<div class="empty-state">
			<p>Aucun résultat pour « {data.query} »</p>
			<p class="empty-hint">Essayez avec un autre terme de recherche</p>
		</div>
	{/if}
{:else if data.query && data.query.length < 2}
	<div class="empty-state">
		<p>Entrez au moins 2 caractères pour rechercher</p>
	</div>
{:else}
	<div class="empty-state">
		<p>Entrez un terme de recherche</p>
		<p class="empty-hint">Vous pouvez rechercher par nom d'élu, groupe politique, ou titre de scrutin</p>
	</div>
{/if}

<style>
	.search-container {
		margin-bottom: 2rem;
	}

	.search-form {
		display: flex;
		gap: 1rem;
	}

	.search-input {
		flex: 1;
		font-size: 1.125rem;
		padding: 0.75rem 1rem;
	}

	.results-summary {
		margin-bottom: 2rem;
		color: var(--color-text-muted);
	}

	.results-count {
		font-weight: 600;
		color: var(--color-text);
	}

	.results-section {
		margin-bottom: 2.5rem;
	}

	.results-section h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.section-count {
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--color-text-muted);
	}

	/* Groups list */
	.groups-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.group-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--color-surface);
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
		transition: box-shadow 0.2s;
	}

	.group-item:hover {
		box-shadow: var(--shadow-md);
		text-decoration: none;
	}

	.group-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.group-info {
		flex: 1;
		min-width: 0;
	}

	.group-name {
		font-weight: 500;
	}

	.group-short {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin-left: 0.25rem;
	}

	.group-chamber {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		padding: 0.25rem 0.5rem;
		background: var(--color-bg);
		border-radius: 4px;
	}

	/* Scrutins list */
	.scrutins-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.scrutin-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-surface);
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
		transition: box-shadow 0.2s;
	}

	.scrutin-item:hover {
		box-shadow: var(--shadow-md);
		text-decoration: none;
	}

	.scrutin-info {
		flex: 1;
		min-width: 0;
	}

	.scrutin-title {
		display: block;
		font-weight: 500;
		line-height: 1.4;
	}

	.scrutin-meta {
		display: flex;
		gap: 1rem;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.scrutin-leg {
		padding: 0.125rem 0.375rem;
		background: var(--color-bg);
		border-radius: 4px;
	}

	.scrutin-result {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		flex-shrink: 0;
	}

	.scrutin-result.adopte {
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success);
	}

	.scrutin-result.rejete {
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger);
	}

	.empty-hint {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-top: 0.5rem;
	}

	@media (max-width: 640px) {
		.search-form {
			flex-direction: column;
		}
	}
</style>
