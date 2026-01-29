<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ElectedCard from '$lib/components/ElectedCard.svelte';
	import PeriodFilter from '$lib/components/PeriodFilter.svelte';

	let { data } = $props();

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

	function goToPage(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', p.toString());
		goto(`?${params.toString()}`);
	}
</script>

<div class="page-header">
	<h1 class="page-title">Députés</h1>
	<p class="page-subtitle">{data.pagination.total} députés de l'Assemblée nationale</p>
</div>

<div class="filters">
	<form onsubmit={handleSearch} class="search-box" style="flex: 1; max-width: 400px;">
		<input
			type="text"
			class="input"
			placeholder="Rechercher un député..."
			bind:value={searchInput}
		/>
	</form>
	<PeriodFilter legislature={data.filters.legislature} />
</div>

{#if data.deputies.length === 0}
	<div class="empty-state">
		<p>Aucun député trouvé</p>
	</div>
{:else}
	<div class="card-grid">
		{#each data.deputies as deputy}
			<ElectedCard
				id={deputy.id}
				name={deputy.fullName}
				photoUrl={deputy.photoUrl}
				group={deputy.group}
				subtitle={deputy.profession || ''}
			/>
		{/each}
	</div>

	<div class="pagination">
		<button onclick={() => goToPage(data.pagination.page - 1)} disabled={data.pagination.page <= 1}>
			Précédent
		</button>
		<span class="pagination-info">
			Page {data.pagination.page} sur {data.pagination.totalPages}
		</span>
		<button onclick={() => goToPage(data.pagination.page + 1)} disabled={data.pagination.page >= data.pagination.totalPages}>
			Suivant
		</button>
	</div>
{/if}

