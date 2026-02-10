<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchInput = $state(data.filters.search);
	// svelte-ignore state_referenced_locally
	let meps = $state(data.meps);
	// svelte-ignore state_referenced_locally
	let currentPage = $state(data.pagination.page);
	let loading = $state(false);
	let hasMore = $derived(currentPage < data.pagination.totalPages);

	let sentinel: HTMLDivElement | null = $state(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Reset when initial data changes
	$effect(() => {
		meps = data.meps;
		currentPage = data.pagination.page;
	});

	// Sync searchInput with URL when data changes
	$effect(() => {
		searchInput = data.filters.search;
	});

	// Debounced search
	$effect(() => {
		const query = searchInput;
		const currentQuery = data.filters.search;

		if (query === currentQuery) return;

		if (debounceTimer) clearTimeout(debounceTimer);

		debounceTimer = setTimeout(() => {
			doSearch(query);
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	// IntersectionObserver for infinite scroll
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
			const response = await fetch(`/pe/eurodeputes?${params.toString()}`, {
				headers: { Accept: 'application/json' }
			});
			const newData = await response.json();

			// Deduplicate by ID to avoid Svelte each_key_duplicate error
			const existingIds = new Set(meps.map((m) => m.id));
			const newMeps = newData.meps.filter((m: { id: string }) => !existingIds.has(m.id));
			meps = [...meps, ...newMeps];
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
	<h1 class="page-title">Eurodéputés</h1>
	<p class="page-subtitle">{data.pagination.total} eurodéputés français au Parlement européen</p>
</div>

<div class="filters">
	<form onsubmit={handleSearch} class="search-box" style="flex: 1; max-width: 400px;">
		<input
			type="text"
			class="input"
			placeholder="Rechercher un eurodéputé..."
			bind:value={searchInput}
		/>
	</form>
</div>

{#if meps.length === 0}
	<div class="empty-state">
		<p>Aucun eurodéputé trouvé</p>
	</div>
{:else}
	<div class="card-grid">
		{#each meps as mep (mep.id)}
			<ElectedCard
				id={mep.id}
				name={mep.fullName}
				photoUrl={mep.photoUrl}
				group={mep.group}
				subtitle={mep.profession || ''}
				type="eurodepute"
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
