<script lang="ts">
	let { data } = $props();

	// Calculate total for percentages
	const totalDeputies = data.groupDistribution.reduce((sum, g) => sum + g.deputyCount, 0);

	// Political spectrum order (left to right)
	const spectrumOrder = ['PO_GP_LFI', 'PO_GP_GDR', 'PO_GP_ECO', 'PO_GP_SOC', 'PO_GP_LIOT', 'PO_GP_MODEM', 'PO_GP_REN', 'PO_GP_HOR', 'PO_GP_LR', 'PO_GP_RN', 'PO_GP_NI'];

	const sortedGroups = [...data.groupDistribution].sort((a, b) => {
		return spectrumOrder.indexOf(a.groupId) - spectrumOrder.indexOf(b.groupId);
	});
</script>

<svelte:head>
	<title>Carte politique - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Carte politique</h1>
	<p class="page-subtitle">Répartition des forces politiques à l'Assemblée nationale</p>
</div>

<div class="card" style="margin-bottom: 1.5rem;">
	<h2>Hémicycle de l'Assemblée nationale</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Répartition des {totalDeputies} députés par groupe parlementaire (16ème législature)
	</p>

	<div class="hemicycle-container">
		<div class="hemicycle-bar">
			{#each sortedGroups as group}
				{@const widthPct = (group.deputyCount / totalDeputies) * 100}
				<a
					href="/groupes/{group.groupId}"
					class="hemicycle-segment"
					style="flex: {group.deputyCount}; background: {group.groupColor || '#888'};"
					title="{group.groupShortName || group.groupName}: {group.deputyCount} députés ({widthPct.toFixed(1)}%)"
				>
					{#if widthPct > 6}
						<span class="segment-label">{group.groupShortName}</span>
						<span class="segment-count">{group.deputyCount}</span>
					{/if}
				</a>
			{/each}
		</div>
		<div class="spectrum-labels">
			<span class="spectrum-left">← Gauche</span>
			<span class="spectrum-right">Droite →</span>
		</div>
	</div>

	<div class="hemicycle-legend">
		{#each sortedGroups as group}
			<a href="/groupes/{group.groupId}" class="legend-item">
				<span class="legend-color" style="background: {group.groupColor || '#888'}"></span>
				<span class="legend-name">{group.groupShortName || group.groupName}</span>
				<span class="legend-count">{group.deputyCount}</span>
			</a>
		{/each}
	</div>
</div>

<div class="card" style="margin-bottom: 1.5rem;">
	<h2>Répartition politique</h2>
	<div class="bar-chart">
		{#each sortedGroups as group}
			{@const widthPct = (group.deputyCount / totalDeputies) * 100}
			<div class="bar-row">
				<a href="/groupes/{group.groupId}" class="bar-label">{group.groupShortName}</a>
				<div class="bar-track">
					<div
						class="bar-fill"
						style="width: {widthPct * 2}%; background: {group.groupColor || '#888'};"
					></div>
				</div>
				<span class="bar-value">{group.deputyCount}</span>
			</div>
		{/each}
	</div>
	<div class="majority-line">
		<div class="majority-marker" style="left: {(289 / totalDeputies) * 100}%">
			<span class="majority-label">Majorité absolue (289)</span>
		</div>
	</div>
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

	/* Hemicycle Bar */
	.hemicycle-container {
		margin: 1.5rem 0;
	}

	.hemicycle-bar {
		display: flex;
		height: 80px;
		border-radius: 40px 40px 0 0;
		overflow: hidden;
		box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
	}

	.hemicycle-segment {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: white;
		text-shadow: 0 1px 2px rgba(0,0,0,0.3);
		min-width: 0;
		text-decoration: none;
		transition: transform 0.2s, filter 0.2s;
	}

	.hemicycle-segment:hover {
		filter: brightness(1.1);
		transform: scaleY(1.05);
		z-index: 1;
		text-decoration: none;
	}

	.segment-label {
		font-size: 0.7rem;
		font-weight: 700;
	}

	.segment-count {
		font-size: 0.6rem;
		opacity: 0.9;
	}

	.spectrum-labels {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.hemicycle-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
		margin-top: 1rem;
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

	/* Bar Chart */
	.bar-chart {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.bar-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.bar-label {
		width: 50px;
		font-size: 0.75rem;
		font-weight: 600;
		text-align: right;
		color: inherit;
		text-decoration: none;
	}

	.bar-label:hover {
		color: var(--color-primary);
	}

	.bar-track {
		flex: 1;
		height: 24px;
		background: var(--color-bg);
		border-radius: 4px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.bar-value {
		width: 40px;
		font-size: 0.875rem;
		font-weight: 600;
		text-align: right;
	}

	.majority-line {
		position: relative;
		height: 2px;
		background: var(--color-border);
		margin: 1rem 50px 0 50px;
	}

	.majority-marker {
		position: absolute;
		top: -8px;
		transform: translateX(-50%);
	}

	.majority-marker::before {
		content: '';
		display: block;
		width: 2px;
		height: 18px;
		background: var(--color-danger);
		margin: 0 auto;
	}

	.majority-label {
		display: block;
		font-size: 0.65rem;
		color: var(--color-danger);
		white-space: nowrap;
		margin-top: 4px;
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
