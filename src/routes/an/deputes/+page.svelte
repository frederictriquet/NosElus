<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchInput = $state(data.filters.search);
	// svelte-ignore state_referenced_locally
	let deputies = $state(data.deputies);
	// svelte-ignore state_referenced_locally
	let currentPage = $state(data.pagination.page);
	let loading = $state(false);
	let hasMore = $derived(currentPage < data.pagination.totalPages);

	let sentinel: HTMLDivElement | null = $state(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Reset quand les données initiales changent (nouvelle recherche, nouveau filtre)
	$effect(() => {
		deputies = data.deputies;
		currentPage = data.pagination.page;
	});

	// Sync searchInput with URL when data changes (e.g., back/forward navigation)
	$effect(() => {
		searchInput = data.filters.search;
	});

	// Debounced search
	$effect(() => {
		const query = searchInput;
		const currentQuery = data.filters.search;

		// Ne rien faire si la valeur est identique
		if (query === currentQuery) return;

		if (debounceTimer) clearTimeout(debounceTimer);

		debounceTimer = setTimeout(() => {
			doSearch(query);
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	// IntersectionObserver pour charger plus
	$effect(() => {
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loading) {
					loadMore();
				}
			},
			{ rootMargin: '200px' }
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	});

	function doSearch(query: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (query) {
			params.set('q', query);
		} else {
			params.delete('q');
		}
		params.delete('page');
		goto(`?${params.toString()}`, { keepFocus: true });
	}

	async function loadMore() {
		if (loading || !hasMore) return;
		loading = true;

		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', (currentPage + 1).toString());

		try {
			const response = await fetch(`/an/deputes?${params.toString()}`, {
				headers: { Accept: 'application/json' }
			});
			const newData = await response.json();

			// Deduplicate by ID to avoid Svelte each_key_duplicate error
			const existingIds = new Set(deputies.map((d) => d.id));
			const newDeputies = newData.deputies.filter((d: { id: string }) => !existingIds.has(d.id));
			deputies = [...deputies, ...newDeputies];
			currentPage = newData.pagination.page;
		} catch (e) {
			console.error('Erreur chargement:', e);
		} finally {
			loading = false;
		}
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		if (debounceTimer) clearTimeout(debounceTimer);
		doSearch(searchInput);
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
</div>

{#if deputies.length === 0}
	<div class="empty-state">
		<p>Aucun député trouvé</p>
	</div>
{:else}
	<div class="card-grid">
		{#each deputies as deputy (deputy.id)}
			<ElectedCard
				id={deputy.id}
				name={deputy.fullName}
				photoUrl={deputy.photoUrl}
				group={deputy.group}
				subtitle={deputy.profession || ''}
			/>
		{/each}
	</div>

	{#if hasMore}
		<div bind:this={sentinel} class="load-more-sentinel">
			{#if loading}
				<span class="loading-spinner"></span>
				<span>Chargement...</span>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.load-more-sentinel {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem;
		color: var(--color-text-muted);
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
