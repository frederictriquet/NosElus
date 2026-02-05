<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();

	function getTightLabel(margin: number): string | null {
		if (margin === 0) return 'Égalité parfaite';
		if (margin <= 5) return 'Très serré';
		if (margin <= 10) return 'Serré';
		if (margin <= 20) return 'Assez serré';
		return null;
	}

	const categoryLabels: Record<string, string> = {
		'vote-final': 'Vote final',
		amendement: 'Amendement',
		article: 'Article',
		procedure: 'Procédure',
		budget: 'Budget',
		constitutionnel: 'Constitutionnel',
		autre: 'Autre'
	};

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function updateFilter(key: string, value: string | null) {
		const url = new URL($page.url);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
		// Reset to page 1 when changing filters
		url.searchParams.set('page', '1');
		goto(url.toString());
	}

	function changePage(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', newPage.toString());
		goto(url.toString());
	}

	// Stats rapides
	const tieCount = data.scrutins.filter((s) => s.isTie).length;
	const veryTightCount = data.scrutins.filter((s) => s.margin > 0 && s.margin <= 5).length;
</script>

<svelte:head>
	<title>Votes serrés - NosElus</title>
	<meta
		name="description"
		content="Scrutins à l'Assemblée nationale où chaque voix comptait vraiment"
	/>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Votes serrés</h1>
	<p class="page-subtitle">Scrutins où chaque voix comptait</p>
</div>

<!-- Filtres -->
<section class="card filters-card">
	<h2>Filtres</h2>

	<div class="filters-grid">
		<!-- Seuil -->
		<div class="filter-group">
			<label for="threshold">Marge maximale</label>
			<select
				id="threshold"
				value={data.filters.threshold}
				onchange={(e) => updateFilter('seuil', e.currentTarget.value)}
			>
				{#each data.thresholds as threshold}
					<option value={threshold}>
						{data.thresholdLabels[threshold]}
					</option>
				{/each}
			</select>
		</div>

		<!-- Catégorie -->
		<div class="filter-group">
			<label for="category">Catégorie</label>
			<select
				id="category"
				value={data.filters.category || ''}
				onchange={(e) => updateFilter('category', e.currentTarget.value || null)}
			>
				<option value="">Toutes les catégories</option>
				{#each data.categories as cat}
					<option value={cat.category}>
						{cat.label} ({cat.count})
					</option>
				{/each}
			</select>
		</div>
	</div>
</section>

<!-- Stats rapides -->
<div class="stats-grid">
	<div class="stat-card">
		<div class="stat-value">{data.pagination.total}</div>
		<div class="stat-label">Scrutins serrés</div>
	</div>
	{#if tieCount > 0}
		<div class="stat-card">
			<div class="stat-value" style="color: var(--color-info);">{tieCount}</div>
			<div class="stat-label">Égalités parfaites</div>
		</div>
	{/if}
	{#if veryTightCount > 0}
		<div class="stat-card">
			<div class="stat-value" style="color: var(--color-warning);">{veryTightCount}</div>
			<div class="stat-label">Très serrés (1-5 voix)</div>
		</div>
	{/if}
</div>

<!-- Liste des scrutins -->
<section class="scrutins-list">
	{#if data.scrutins.length === 0}
		<div class="empty-state">
			<p>Aucun scrutin serré trouvé avec ces critères.</p>
		</div>
	{:else}
		{#each data.scrutins as scrutin}
			<a href="/an/scrutins/{scrutin.id}" class="scrutin-card">
				<div class="scrutin-header">
					<div class="scrutin-badges">
						<span class="scrutin-number">Scrutin n°{scrutin.number}</span>
						{#if scrutin.category}
							<span class="category-badge">
								{categoryLabels[scrutin.category] || scrutin.category}
							</span>
						{/if}
						<span
							class="tight-vote-badge"
							class:tie={scrutin.isTie}
							title="Marge de {scrutin.margin} voix"
						>
							{getTightLabel(scrutin.margin)}
						</span>
						{#if scrutin.result}
							<span
								class="result-badge"
								class:adopted={scrutin.result === 'adopté'}
								class:rejected={scrutin.result === 'rejeté'}
							>
								{scrutin.result}
							</span>
						{/if}
					</div>
					<span class="scrutin-date">{formatDate(scrutin.date)}</span>
				</div>
				<h3 class="scrutin-title">{scrutin.title}</h3>
				<div class="scrutin-results">
					<div class="result-bar">
						<div
							class="result-segment for"
							style="width: {(scrutin.totalFor / (scrutin.totalFor + scrutin.totalAgainst)) * 100}%"
						>
							<span>{scrutin.totalFor} pour</span>
						</div>
						<div
							class="result-segment against"
							style="width: {(scrutin.totalAgainst / (scrutin.totalFor + scrutin.totalAgainst)) *
								100}%"
						>
							<span>{scrutin.totalAgainst} contre</span>
						</div>
					</div>
					<div class="margin-indicator">Marge : {scrutin.margin} voix</div>
				</div>
			</a>
		{/each}
	{/if}
</section>

<!-- Pagination -->
{#if data.pagination.totalPages > 1}
	<nav class="pagination" aria-label="Pagination">
		<button
			onclick={() => changePage(data.pagination.page - 1)}
			disabled={!data.pagination.hasPrevious}
		>
			← Précédent
		</button>

		<span class="page-info">
			Page {data.pagination.page} sur {data.pagination.totalPages}
		</span>

		<button
			onclick={() => changePage(data.pagination.page + 1)}
			disabled={!data.pagination.hasNext}
		>
			Suivant →
		</button>
	</nav>
{/if}

<style>
	.filters-card {
		margin-bottom: 1.5rem;
	}

	.filters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.filter-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		font-size: 0.875rem;
	}

	.filter-group select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.scrutins-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.scrutin-card {
		display: block;
		padding: 1.25rem;
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: all 0.2s;
	}

	.scrutin-card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-1px);
	}

	.scrutin-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.scrutin-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.scrutin-number {
		padding: 0.25rem 0.5rem;
		background: var(--color-primary-bg);
		color: var(--color-primary);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.category-badge {
		padding: 0.25rem 0.5rem;
		background: var(--color-muted-bg);
		color: var(--color-text-muted);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}

	.tight-vote-badge {
		padding: 0.25rem 0.5rem;
		background: var(--color-warning-bg);
		color: var(--color-warning);
		border: 1px solid var(--color-warning-border);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.tight-vote-badge.tie {
		background: var(--color-info-bg);
		color: var(--color-info);
		border-color: var(--color-info-border);
	}

	.result-badge {
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.result-badge.adopted {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.result-badge.rejected {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.scrutin-date {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.scrutin-title {
		font-size: 1rem;
		font-weight: 500;
		margin: 0 0 0.75rem 0;
		line-height: 1.4;
	}

	.scrutin-results {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.result-bar {
		flex: 1;
		display: flex;
		height: 2rem;
		border-radius: var(--radius-sm);
		overflow: hidden;
		font-size: 0.875rem;
	}

	.result-segment {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.5rem;
		color: white;
		font-weight: 500;
		transition: width 0.3s;
	}

	.result-segment.for {
		background: var(--color-success);
	}

	.result-segment.against {
		background: var(--color-danger);
	}

	.result-segment span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.margin-indicator {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-warning);
		white-space: nowrap;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--color-text-muted);
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
	}

	.pagination button {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-card);
		color: var(--color-text);
		cursor: pointer;
		transition: all 0.2s;
	}

	.pagination button:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.pagination button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}
</style>
