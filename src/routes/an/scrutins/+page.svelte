<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchInput = $state(data.filters.search);

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams($page.url.searchParams);
		if (searchInput) {
			params.set('q', searchInput);
		} else {
			params.delete('q');
		}
		params.set('page', '1');
		goto(`?${params.toString()}`);
	}

	function setFilter(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		params.set('page', '1');
		goto(`?${params.toString()}`);
	}

	function goToPage(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', p.toString());
		goto(`?${params.toString()}`);
	}
</script>

<div class="page-header">
	<h1 class="page-title">Scrutins</h1>
	<p class="page-subtitle">{data.pagination.total} scrutins publics</p>
</div>

<div class="filters">
	<form onsubmit={handleSearch} class="search-box search-box-form">
		<input
			type="text"
			class="input"
			placeholder="Rechercher un scrutin..."
			bind:value={searchInput}
		/>
	</form>
	<select
		class="input"
		style="width: auto;"
		onchange={(e) => setFilter('category', e.currentTarget.value)}
	>
		<option value="">Tous les types</option>
		{#each data.categories as cat}
			<option value={cat.category} selected={data.filters.category === cat.category}>
				{cat.label} ({cat.count})
			</option>
		{/each}
	</select>
	<select
		class="input"
		style="width: auto;"
		onchange={(e) => setFilter('result', e.currentTarget.value)}
	>
		<option value="">Tous les résultats</option>
		<option value="adopté" selected={data.filters.result === 'adopté'}>Adoptés</option>
		<option value="rejeté" selected={data.filters.result === 'rejeté'}>Rejetés</option>
	</select>
</div>

{#if data.scrutins.length === 0}
	<div class="empty-state">
		<p>Aucun scrutin trouvé</p>
	</div>
{:else}
	<div class="scrutins-list">
		{#each data.scrutins as scrutin}
			{@const total = scrutin.totalFor + scrutin.totalAgainst + scrutin.totalAbstention || 1}
			<a
				href="/an/scrutins/{scrutin.id}"
				class="scrutin-card"
				class:adopted={scrutin.result === 'adopté'}
				class:rejected={scrutin.result === 'rejeté'}
			>
				<div class="scrutin-header">
					<span class="scrutin-number">n°{scrutin.number}</span>
					<span
						class="scrutin-result"
						class:adopted={scrutin.result === 'adopté'}
						class:rejected={scrutin.result === 'rejeté'}
					>
						{scrutin.result}
					</span>
				</div>
				<div class="scrutin-title">{scrutin.title}</div>
				<div class="scrutin-meta">
					<span>{new Date(scrutin.date).toLocaleDateString('fr-FR')}</span>
					<span>{scrutin.totalVoters} votants</span>
					<span style="color: var(--color-success);">{scrutin.totalFor} pour</span>
					<span style="color: var(--color-danger);">{scrutin.totalAgainst} contre</span>
					<span style="color: var(--color-warning);">{scrutin.totalAbstention} abstentions</span>
				</div>
				<div class="vote-bar">
					<div class="vote-bar-for" style="width: {(scrutin.totalFor / total) * 100}%"></div>
					<div
						class="vote-bar-against"
						style="width: {(scrutin.totalAgainst / total) * 100}%"
					></div>
					<div
						class="vote-bar-abstention"
						style="width: {(scrutin.totalAbstention / total) * 100}%"
					></div>
				</div>
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
	.scrutin-card {
		display: block;
		text-decoration: none;
		color: inherit;
	}

	.scrutin-card:hover {
		text-decoration: none;
	}

	.scrutin-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.scrutin-number {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.search-box-form {
		flex: 1;
		max-width: 400px;
	}

	.scrutins-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
