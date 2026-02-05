<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ElectedCard from '$lib/components/ElectedCard.svelte';
	import GroupName from '$lib/components/GroupName.svelte';
	import { sortByPoliticalPosition } from '$lib/utils/political-spectrum';

	let { data } = $props();

	// Type for group distribution (includes politicalPosition from DB)
	type GroupDistribution = {
		groupId: string;
		groupName: string;
		groupShortName: string;
		groupColor: string;
		deputyCount: number;
		politicalPosition: number | null;
	};

	/**
	 * Trie les groupes par position politique (gauche → droite → NI)
	 * Utilise les positions stockées en base de données via ParlGov ETL
	 */
	function sortBySpectrum(groups: GroupDistribution[]): GroupDistribution[] {
		// Adapter le format pour sortByPoliticalPosition
		const adapted = groups.map((g) => ({
			id: g.groupId,
			name: g.groupName,
			shortName: g.groupShortName,
			politicalPosition: g.politicalPosition
		}));

		const sorted = sortByPoliticalPosition(adapted);

		// Remettre dans l'ordre trié
		return sorted.map((s) => groups.find((g) => g.groupId === s.id)!);
	}
</script>

<svelte:head>
	<title>Carte politique - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Carte politique</h1>
	<p class="page-subtitle">Répartition des forces politiques à l'Assemblée nationale</p>
</div>

{#await data.groupData}
	<div class="card" style="margin-bottom: 1.5rem;">
		<h2>Hémicycle de l'Assemblée nationale</h2>
		<div class="loading-container" style="min-height: 300px;">
			<div class="spinner"></div>
			<span class="loading-text">Chargement...</span>
		</div>
	</div>

	<div class="card" style="margin-bottom: 1.5rem;">
		<h2>Répartition politique</h2>
		<div class="loading-container" style="min-height: 200px;">
			<div class="spinner"></div>
			<span class="loading-text">Chargement...</span>
		</div>
	</div>
{:then groupData}
	{@const sortedGroups = sortBySpectrum(groupData.groupDistribution)}
	{@const totalDeputies = groupData.totalDeputies}
	{@const majorityThreshold = Math.floor(totalDeputies / 2) + 1}
	{@const maxGroupSize = Math.max(...sortedGroups.map((g) => g.deputyCount), 0)}
	{@const barScaleMax = Math.max(maxGroupSize, majorityThreshold) * 1.05}

	<div class="card" style="margin-bottom: 1.5rem;">
		<h2>Hémicycle de l'Assemblée nationale</h2>
		<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
			Répartition des {totalDeputies} députés par groupe parlementaire ({data.legislatureLabel})
		</p>

		<div class="hemicycle-container">
			<svg viewBox="0 0 400 220" class="hemicycle-svg">
				{#each sortedGroups as group, i}
					{@const startAngle = sortedGroups
						.slice(0, i)
						.reduce((sum, g) => sum + (g.deputyCount / totalDeputies) * 180, 0)}
					{@const angle = (group.deputyCount / totalDeputies) * 180}
					{@const startRad = ((180 + startAngle) * Math.PI) / 180}
					{@const endRad = ((180 + startAngle + angle) * Math.PI) / 180}
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
					<a href="/an/groupes/{group.groupId}">
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
				<a href="/an/groupes/{group.groupId}" class="legend-item">
					<span class="legend-color" style="background: {group.groupColor || '#888'}"></span>
					<span class="legend-name">
						<GroupName shortName={group.groupShortName} fullName={group.groupName} />
					</span>
					<span class="legend-count">{group.deputyCount}</span>
				</a>
			{/each}
		</div>
	</div>

	<div class="card" style="margin-bottom: 1.5rem;">
		<h2>Répartition politique</h2>
		<div class="bar-chart-container">
			<div class="bar-chart">
				{#each sortedGroups as group}
					{@const widthPct = (group.deputyCount / barScaleMax) * 100}
					<div class="bar-row">
						<a href="/an/groupes/{group.groupId}" class="bar-label">
							<GroupName shortName={group.groupShortName} fullName={group.groupName} />
						</a>
						<div class="bar-track">
							<div
								class="bar-fill"
								style="width: {widthPct}%; background: {group.groupColor || '#888'};"
							></div>
						</div>
						<span class="bar-value">{group.deputyCount}</span>
					</div>
				{/each}
			</div>
			{#if totalDeputies > 0}
				<div
					class="majority-line"
					style="left: calc(50px + 0.75rem + (100% - 50px - 0.75rem - 40px - 0.75rem) * {majorityThreshold /
						barScaleMax});"
				>
					<span class="majority-label">Majorité ({majorityThreshold})</span>
				</div>
			{/if}
		</div>
	</div>

	<AsyncCard title="Députés par groupe" promise={data.deputiesByGroup} minHeight="300px">
		{#snippet children(deputiesByGroup)}
			<div class="groups-grid">
				{#each groupData.groupDistribution as group}
					<div class="group-card">
						<div class="group-header">
							<span class="group-color" style="background: {group.groupColor || '#888'}"></span>
							<a href="/an/groupes/{group.groupId}" class="group-name">
								<GroupName shortName={group.groupShortName} fullName={group.groupName} />
							</a>
							<span class="group-count">{group.deputyCount} députés</span>
						</div>
						{#if deputiesByGroup[group.groupId]?.length > 0}
							<div class="group-deputies">
								{#each deputiesByGroup[group.groupId] as deputy}
									<ElectedCard
										id={deputy.id}
										name={deputy.name}
										photoUrl={deputy.photoUrl}
										variant="thumbnail"
										group={{
											id: group.groupId,
											shortName: group.groupShortName,
											color: group.groupColor
										}}
									/>
								{/each}
								{#if group.deputyCount > 5}
									<a href="/an/deputes?groupe={group.groupId}" class="deputy-more"
										>+{group.deputyCount - 5}</a
									>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/snippet}
	</AsyncCard>
{/await}

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	/* Loading */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: var(--color-text-muted);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		font-size: 0.875rem;
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
		transition:
			opacity 0.2s,
			transform 0.2s;
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
	.bar-chart-container {
		position: relative;
		margin-top: 1rem;
	}

	.bar-chart {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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

	.majority-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--color-danger);
		transform: translateX(-50%);
		z-index: 10;
		pointer-events: none;
	}

	.majority-label {
		position: absolute;
		bottom: -20px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.65rem;
		color: var(--color-danger);
		white-space: nowrap;
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
