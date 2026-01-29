<script lang="ts">
	import { goto } from '$app/navigation';
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();

	// Political spectrum order (left to right) - includes both old and new group IDs
	const spectrumOrder = [
		'PO_GP_LFI', 'PO845413', 'LFI-NFP',
		'PO_GP_GDR', 'PO845514', 'GDR',
		'PO_GP_ECO', 'PO845439', 'EcoS',
		'PO_GP_SOC', 'PO845419', 'SOC',
		'PO_GP_LIOT', 'PO845485', 'LIOT',
		'PO_GP_MODEM', 'PO845454', 'Dem',
		'PO_GP_REN', 'PO845407', 'EPR',
		'PO_GP_HOR', 'PO845470', 'HOR',
		'PO_GP_LR', 'PO845425', 'DR',
		'PO845520', 'AD',
		'PO847173', 'PO872880', 'UDR',
		'PO_GP_RN', 'PO845401', 'RN',
		'PO_GP_NI', 'PO840056', 'NI'
	];

	// Reactive computed values
	const totalDeputies = $derived(data.totalDeputies);

	const sortedGroups = $derived([...data.groupDistribution].sort((a, b) => {
		const aIndex = spectrumOrder.findIndex(id => a.groupId.includes(id) || a.groupShortName === id);
		const bIndex = spectrumOrder.findIndex(id => b.groupId.includes(id) || b.groupShortName === id);
		return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
	}));

	// Législatures disponibles
	const LEGISLATURES = [
		{ value: '17', label: '17e (2024-)' },
		{ value: '16', label: '16e (2022-2024)' },
		{ value: '15', label: '15e (2017-2022)' },
		{ value: '14', label: '14e (2012-2017)' },
		{ value: '13', label: '13e (2007-2012)' },
		{ value: '12', label: '12e (2002-2007)' }
	];

	function handleLegislatureChange(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value;
		goto(`/carte?legislature=${value}`);
	}
</script>

<svelte:head>
	<title>Carte politique - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Carte politique</h1>
	<p class="page-subtitle">Répartition des forces politiques à l'Assemblée nationale</p>
</div>

<div class="filters" style="margin-bottom: 1.5rem;">
	<div class="filter-group">
		<label for="legislature-select" class="filter-label">Législature</label>
		<select
			id="legislature-select"
			class="input"
			value={data.legislature}
			onchange={handleLegislatureChange}
		>
			{#each LEGISLATURES as leg}
				<option value={leg.value}>{leg.label}</option>
			{/each}
		</select>
	</div>
</div>

<div class="card" style="margin-bottom: 1.5rem;">
	<h2>Hémicycle de l'Assemblée nationale</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Répartition des {totalDeputies} députés par groupe parlementaire ({data.legislatureLabel})
	</p>

	<div class="hemicycle-container">
		<svg viewBox="0 0 400 220" class="hemicycle-svg">
			{#each sortedGroups as group, i}
				{@const startAngle = sortedGroups.slice(0, i).reduce((sum, g) => sum + (g.deputyCount / totalDeputies) * 180, 0)}
				{@const angle = (group.deputyCount / totalDeputies) * 180}
				{@const startRad = (180 + startAngle) * Math.PI / 180}
				{@const endRad = (180 + startAngle + angle) * Math.PI / 180}
				{@const outerRadius = 180}
				{@const innerRadius = 100}
				{@const cx = 200}
				{@const cy = 200}
				{@const x1 = cx + outerRadius * Math.cos(startRad)}
				{@const y1 = cy + outerRadius * Math.sin(startRad)}
				{@const x2 = cx + outerRadius * Math.cos(endRad)}
				{@const y2 = cy + outerRadius * Math.sin(endRad)}
				{@const x3 = cx + innerRadius * Math.cos(endRad)}
				{@const y3 = cy + innerRadius * Math.sin(endRad)}
				{@const x4 = cx + innerRadius * Math.cos(startRad)}
				{@const y4 = cy + innerRadius * Math.sin(startRad)}
				{@const largeArc = angle > 180 ? 1 : 0}
				<a href="/groupes/{group.groupId}">
					<path
						d="M {x1} {y1} A {outerRadius} {outerRadius} 0 {largeArc} 1 {x2} {y2} L {x3} {y3} A {innerRadius} {innerRadius} 0 {largeArc} 0 {x4} {y4} Z"
						fill={group.groupColor || '#888'}
						class="hemicycle-arc"
					>
						<title>{group.groupShortName || group.groupName}: {group.deputyCount} députés</title>
					</path>
				</a>
			{/each}
			<text x="200" y="195" text-anchor="middle" class="hemicycle-center-text">Perchoir</text>
		</svg>
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
					{#if group === sortedGroups[sortedGroups.length - 1] && totalDeputies > 0}
						{@const majorityThreshold = Math.floor(totalDeputies / 2) + 1}
						<div class="majority-marker" style="left: {(majorityThreshold / totalDeputies) * 200}%;">
							<span class="majority-label">Majorité ({majorityThreshold})</span>
						</div>
					{/if}
				</div>
				<span class="bar-value">{group.deputyCount}</span>
			</div>
		{/each}
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
							<ElectedCard
								id={deputy.id}
								name={deputy.name}
								photoUrl={deputy.photoUrl}
								variant="thumbnail"
								group={{ id: group.groupId, shortName: group.groupShortName, color: group.groupColor }}
							/>
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

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	/* Hemicycle SVG */
	.hemicycle-container {
		margin: 1.5rem 0;
	}

	.hemicycle-svg {
		width: 100%;
		max-width: 500px;
		height: auto;
		display: block;
		margin: 0 auto;
	}

	.hemicycle-arc {
		transition: opacity 0.2s, transform 0.2s;
		cursor: pointer;
	}

	.hemicycle-arc:hover {
		opacity: 0.85;
	}

	.hemicycle-center-text {
		font-size: 12px;
		fill: var(--color-text-muted);
		font-weight: 500;
	}

	.spectrum-labels {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 10%;
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
		overflow: visible;
		position: relative;
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

	.majority-marker {
		position: absolute;
		top: -300px;
		height: 340px;
		width: 2px;
		background: var(--color-danger);
		transform: translateX(-50%);
		z-index: 10;
	}

	.majority-label {
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
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
