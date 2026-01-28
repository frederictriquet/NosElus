<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let { data } = $props();
	let mapContainer: HTMLDivElement;
	let map: any;
	let L: any;

	// Calculate total for percentages
	const totalDeputies = data.groupDistribution.reduce((sum, g) => sum + g.deputyCount, 0);

	onMount(async () => {
		if (browser) {
			L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');

			// Create map centered on France
			map = L.map(mapContainer).setView([46.603354, 1.888334], 6);

			// Add OpenStreetMap tiles
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);

			// Add a marker for Paris (Assemblée Nationale)
			const marker = L.marker([48.8608, 2.3185]).addTo(map);
			marker.bindPopup('<b>Assemblée Nationale</b><br>Palais Bourbon');
		}
	});
</script>

<svelte:head>
	<title>Carte - NosElus</title>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Carte politique</h1>
	<p class="page-subtitle">Répartition des forces politiques à l'Assemblée nationale</p>
</div>

<div class="card" style="margin-bottom: 1.5rem;">
	<h2>Hémicycle</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Répartition des {totalDeputies} députés par groupe parlementaire
	</p>
	<div class="hemicycle">
		{#each data.groupDistribution as group}
			{@const widthPct = (group.deputyCount / totalDeputies) * 100}
			<div
				class="hemicycle-segment"
				style="flex: {group.deputyCount}; background: {group.groupColor || '#888'};"
				title="{group.groupShortName || group.groupName}: {group.deputyCount} députés ({widthPct.toFixed(1)}%)"
			>
				{#if widthPct > 8}
					<span class="segment-label">{group.groupShortName}</span>
					<span class="segment-count">{group.deputyCount}</span>
				{/if}
			</div>
		{/each}
	</div>
	<div class="hemicycle-legend">
		{#each data.groupDistribution as group}
			<a href="/groupes/{group.groupId}" class="legend-item">
				<span class="legend-color" style="background: {group.groupColor || '#888'}"></span>
				<span class="legend-name">{group.groupShortName || group.groupName}</span>
				<span class="legend-count">{group.deputyCount}</span>
			</a>
		{/each}
	</div>
</div>

<div class="card" style="margin-bottom: 1.5rem;">
	<h2>Carte de France</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Assemblée Nationale - Palais Bourbon
	</p>
	<div bind:this={mapContainer} class="map-container"></div>
	<p style="color: var(--color-text-muted); font-size: 0.75rem; margin-top: 0.5rem; font-style: italic;">
		Note : Les données de circonscription ne sont pas encore importées. La carte complète avec la répartition par circonscription sera disponible après l'import des données de mandats.
	</p>
</div>

<section class="card">
	<h2>Députés par groupe</h2>
	<div class="groups-grid">
		{#each data.groupDistribution as group}
			<div class="group-card">
				<div class="group-header">
					<span class="group-color" style="background: {group.groupColor || '#888'}"></span>
					<a href="/groupes/{group.groupId}" class="group-name">{group.groupShortName || group.groupName}</a>
					<span class="group-count">{group.deputyCount} députés</span>
				</div>
				{#if data.deputiesByGroup[group.groupId]?.length > 0}
					<div class="group-deputies">
						{#each data.deputiesByGroup[group.groupId] as deputy}
							<a href="/deputes/{deputy.id}" class="deputy-thumb" title={deputy.name}>
								<img src={deputy.photoUrl || '/placeholder.png'} alt={deputy.name} />
							</a>
						{/each}
						{#if group.deputyCount > 5}
							<a href="/deputes?groupe={group.groupId}" class="deputy-more">+{group.deputyCount - 5}</a>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.hemicycle {
		display: flex;
		height: 60px;
		border-radius: 30px 30px 0 0;
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.hemicycle-segment {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: white;
		text-shadow: 0 1px 2px rgba(0,0,0,0.3);
		min-width: 0;
		transition: transform 0.2s;
	}

	.hemicycle-segment:hover {
		transform: scaleY(1.1);
		z-index: 1;
	}

	.segment-label {
		font-size: 0.75rem;
		font-weight: 600;
	}

	.segment-count {
		font-size: 0.65rem;
	}

	.hemicycle-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		text-decoration: none;
		color: inherit;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius);
		transition: background 0.2s;
	}

	.legend-item:hover {
		background: var(--color-bg);
		text-decoration: none;
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}

	.legend-name {
		font-weight: 500;
	}

	.legend-count {
		color: var(--color-text-muted);
	}

	.map-container {
		height: 400px;
		border-radius: var(--radius);
		z-index: 0;
	}

	.groups-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.group-card {
		background: var(--color-bg);
		border-radius: var(--radius);
		padding: 1rem;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.group-color {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.group-name {
		font-weight: 600;
		flex: 1;
		color: inherit;
		text-decoration: none;
	}

	.group-name:hover {
		color: var(--color-primary);
	}

	.group-count {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.group-deputies {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.deputy-thumb {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--color-surface);
	}

	.deputy-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.deputy-more {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-decoration: none;
	}

	.deputy-more:hover {
		background: var(--color-primary);
		color: white;
		text-decoration: none;
	}
</style>
