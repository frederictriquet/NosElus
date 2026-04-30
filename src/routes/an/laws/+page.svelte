<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import TagBadge from '$lib/components/TagBadge.svelte';

	let { data } = $props();

	function goToPage(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', p.toString());
		goto(`?${params.toString()}`);
	}

	const typeLabels: Record<string, string> = {
		PJL: 'Projet de loi',
		PPL: 'Proposition de loi',
		PJLF: 'Projet de loi de finances',
		PJLFSS: 'Projet de loi de financement SS',
		PJLR: 'Projet de loi de règlement',
		PJC: 'Projet de loi constitutionnelle',
		PPC: 'Proposition de loi constitutionnelle'
	};

	const statusLabels: Record<string, string> = {
		'en cours': 'En cours',
		adopté: 'Adopté',
		rejeté: 'Rejeté',
		promulgué: 'Promulgué',
		retiré: 'Retiré'
	};

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('fr-FR');
	}
</script>

<svelte:head>
	<title>Dossiers législatifs - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Dossiers législatifs</h1>
	<p class="page-subtitle">{data.pagination.total} dossiers</p>
</div>

<!-- Filters -->
<section class="card filters-card">
	<form method="get" class="filters-form">
		<div class="filter-row">
			<input
				type="text"
				name="q"
				placeholder="Rechercher un texte..."
				value={data.filters.search}
				class="search-input"
			/>
			<select name="type" class="filter-select">
				<option value="">Tous les types</option>
				{#each data.types as type}
					<option value={type} selected={data.filters.type === type}>
						{typeLabels[type] || type}
					</option>
				{/each}
			</select>
			<select name="status" class="filter-select">
				<option value="">Tous les statuts</option>
				{#each data.statuses as status}
					<option value={status} selected={data.filters.status === status}>
						{statusLabels[status] || status}
					</option>
				{/each}
			</select>
			<select name="tag" class="filter-select">
				<option value="">Tous les thèmes</option>
				{#each data.availableTags as availableTag}
					<option value={availableTag.slug} selected={data.filters.tag === availableTag.slug}>
						{availableTag.name}
					</option>
				{/each}
			</select>
			<button type="submit" class="btn btn-primary">Filtrer</button>
		</div>
	</form>
</section>

<!-- Laws list -->
{#if data.laws.length === 0}
	<section class="card">
		<p class="empty-state">Aucun dossier législatif trouvé</p>
	</section>
{:else}
	<div class="laws-list">
		{#each data.laws as law}
			<a href="/an/laws/{law.id}" class="law-card">
				<div class="law-header">
					<span class="law-type">{typeLabels[law.type] || law.type}</span>
					{#if law.status}
						<span
							class="law-status"
							class:status-adopted={law.status === 'adopté' || law.status === 'promulgué'}
							class:status-rejected={law.status === 'rejeté'}
							class:status-pending={law.status === 'en cours'}
						>
							{statusLabels[law.status] || law.status}
						</span>
					{/if}
				</div>
				<h2 class="law-title">{law.shortTitle || law.title}</h2>
				<div class="law-meta">
					{#if law.depositDate}
						<span class="law-date">Déposé le {formatDate(law.depositDate)}</span>
					{/if}
					{#if law.theme}
						<span class="law-theme">{law.theme}</span>
					{/if}
				</div>
				{#if law.tags.length > 0}
					<div class="law-tags">
						{#each law.tags as lawTag}
							<TagBadge tag={lawTag} />
						{/each}
					</div>
				{/if}
			</a>
		{/each}
	</div>

	<div class="pagination">
		<button onclick={() => goToPage(data.pagination.page - 1)} disabled={data.pagination.page <= 1}>
			Précédent
		</button>
		<span class="pagination-info">
			Page {data.pagination.page} sur {data.pagination.totalPages}
		</span>
		<button
			onclick={() => goToPage(data.pagination.page + 1)}
			disabled={data.pagination.page >= data.pagination.totalPages}
		>
			Suivant
		</button>
	</div>
{/if}

<style>
	.filters-card {
		margin-bottom: 1.5rem;
	}

	.filters-form {
		width: 100%;
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.search-input {
		flex: 1;
		min-width: 200px;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.filter-select {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-text);
		min-width: 150px;
	}

	.btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover {
		background: var(--color-primary-dark);
	}

	/* Laws list */
	.laws-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.law-card {
		display: block;
		padding: 1rem 1.25rem;
		background: var(--color-card-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		transition: all 0.2s;
	}

	.law-card:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-primary);
	}

	.law-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.law-type {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.law-status {
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		margin-left: auto;
	}

	.law-status.status-adopted {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.law-status.status-rejected {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.law-status.status-pending {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}

	.law-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.law-meta {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.law-theme {
		padding: 0.125rem 0.5rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-sm);
	}

	.law-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	@media (max-width: 640px) {
		.filter-row {
			flex-direction: column;
		}

		.filter-select {
			width: 100%;
		}
	}
</style>
