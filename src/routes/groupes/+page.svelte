<script lang="ts">
	import PeriodFilter from '$lib/components/PeriodFilter.svelte';

	let { data } = $props();
</script>

<div class="page-header">
	<h1 class="page-title">Groupes parlementaires</h1>
	<p class="page-subtitle">{data.groups.length} groupes à l'Assemblée nationale</p>
</div>

<div class="filters">
	<PeriodFilter legislature={data.filters.legislature} />
</div>

<div class="card-grid">
	{#each data.groups as group}
		<a href="/groupes/{group.id}" class="group-card">
			<div class="group-color" style="background: {group.color || '#ccc'}"></div>
			<div class="group-info">
				<div class="group-name">{group.name}</div>
				<div class="group-short">{group.shortName}</div>
			</div>
		</a>
	{/each}
</div>

<style>
	.group-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
		color: inherit;
		transition: box-shadow 0.2s;
	}

	.group-card:hover {
		box-shadow: var(--shadow-md);
		text-decoration: none;
	}

	.group-color {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.group-info {
		flex: 1;
	}

	.group-name {
		font-weight: 600;
		font-size: 1.125rem;
	}

	.group-short {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
