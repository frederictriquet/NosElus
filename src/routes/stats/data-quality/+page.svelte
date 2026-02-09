<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import type { PageData } from './$types';
	import { formatLegislature, percentage, coverageClass } from './+page.helpers';

	let { data }: { data: PageData } = $props();

	// Filtre chambre (client-side, pas de rechargement)
	type ChamberFilter = 'AN' | 'PE' | 'SENAT';
	let selectedChamber = $state<ChamberFilter>('AN');
</script>

<svelte:head>
	<title>Qualité des données - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Qualité des données</h1>
	<p class="page-subtitle">
		Vue d'ensemble de la complétude et richesse des données disponibles sur NosElus
	</p>
</div>

<!-- KPIs globaux -->
<AsyncCard title="Vue d'ensemble" promise={data.globalStats} minHeight="120px">
	{#snippet children(stats)}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{stats.totalLaws.toLocaleString('fr-FR')}</div>
				<div class="stat-label">Textes de loi</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.totalScrutins.toLocaleString('fr-FR')}</div>
				<div class="stat-label">Scrutins</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.totalActors.toLocaleString('fr-FR')}</div>
				<div class="stat-label">Élus</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.totalVotes.toLocaleString('fr-FR')}</div>
				<div class="stat-label">Votes enregistrés</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.coverageVotes.toFixed(1)}%</div>
				<div class="stat-label">Lois avec votes</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.coverageAI.toFixed(1)}%</div>
				<div class="stat-label">Lois analysées IA</div>
			</div>
		</div>
	{/snippet}
</AsyncCard>

<!-- Filtre chambre -->
<div class="filter-bar">
	<button
		class="filter-btn"
		class:active={selectedChamber === 'AN'}
		onclick={() => (selectedChamber = 'AN')}
	>
		Assemblée nationale
	</button>
	<button
		class="filter-btn"
		class:active={selectedChamber === 'PE'}
		onclick={() => (selectedChamber = 'PE')}
	>
		Parlement européen
	</button>
	<button
		class="filter-btn"
		class:active={selectedChamber === 'SENAT'}
		onclick={() => (selectedChamber = 'SENAT')}
	>
		Sénat
	</button>
</div>

<!-- Couverture des élus par chambre -->
<AsyncCard title="Couverture des élus" promise={data.chamberStats} minHeight="200px">
	{#snippet children(stats)}
		{@const current = stats.find((s) => s.chamber === selectedChamber)}
		{#if !current}
			<p class="empty-state">Aucune donnée disponible pour ce filtre.</p>
		{:else}
			{@const colorPct = percentage(current.groupsWithColor, current.totalGroups)}
			{@const activityPct = percentage(current.actorsWithStats, current.totalActors)}
			<div class="chamber-stats-grid">
				<div class="chamber-stat">
					<div class="chamber-stat-value">{current.totalActors.toLocaleString('fr-FR')}</div>
					<div class="chamber-stat-label">Élus</div>
				</div>
				<div class="chamber-stat">
					<div class="chamber-stat-value">{current.totalGroups}</div>
					<div class="chamber-stat-label">Groupes</div>
				</div>
				<div class="chamber-stat">
					<div class="chamber-stat-value">{current.totalMandates.toLocaleString('fr-FR')}</div>
					<div class="chamber-stat-label">Mandats</div>
				</div>
				<div class="chamber-stat">
					<div class="coverage-cell">
						<span class={coverageClass(colorPct)}>
							{current.groupsWithColor}/{current.totalGroups} ({colorPct.toFixed(0)}%)
						</span>
						<div class="progress-bar">
							<div class="progress-fill {coverageClass(colorPct)}" style="width: {colorPct}%"></div>
						</div>
					</div>
					<div class="chamber-stat-label">Groupes avec couleur</div>
				</div>
				<div class="chamber-stat">
					<div class="coverage-cell">
						<span class={coverageClass(activityPct)}>
							{current.actorsWithStats.toLocaleString('fr-FR')}/{current.totalActors.toLocaleString(
								'fr-FR'
							)}
							({activityPct.toFixed(0)}%)
						</span>
						<div class="progress-bar">
							<div
								class="progress-fill {coverageClass(activityPct)}"
								style="width: {activityPct}%"
							></div>
						</div>
					</div>
					<div class="chamber-stat-label">Élus avec stats d'activité</div>
				</div>
			</div>
		{/if}
	{/snippet}
</AsyncCard>

<!-- Tableau détaillé par législature -->
<AsyncCard title="Couverture par mandature" promise={data.legislatureStats} minHeight="300px">
	{#snippet children(stats)}
		{@const filtered = stats.filter((s) => s.chamber === selectedChamber)}
		{#if filtered.length === 0}
			<p class="empty-state">Aucune donnée de lois disponible pour cette chambre.</p>
		{:else}
			<div class="table-wrapper">
				<table class="data-table">
					<thead>
						<tr>
							<th>Mandature</th>
							<th class="text-right">Lois</th>
							<th class="text-right">Avec votes</th>
							<th class="text-right">Analysées IA</th>
							<th class="text-right">Avec tags</th>
							<th class="text-right">Texte complet</th>
							<th class="text-right">Scrutins</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as row}
							{@const votePct = percentage(row.lawsWithVotes, row.totalLaws)}
							{@const aiPct = percentage(row.lawsWithSummaries, row.totalLaws)}
							{@const tagPct = percentage(row.lawsWithTags, row.totalLaws)}
							{@const descPct = percentage(row.lawsWithDescription, row.totalLaws)}
							<tr>
								<td><strong>{formatLegislature(row.legislature)}</strong></td>
								<td class="text-right">{row.totalLaws.toLocaleString('fr-FR')}</td>
								<td class="text-right">
									<div class="coverage-cell">
										<span class={coverageClass(votePct)}>
											{row.lawsWithVotes} ({votePct.toFixed(1)}%)
										</span>
										<div class="progress-bar">
											<div
												class="progress-fill {coverageClass(votePct)}"
												style="width: {votePct}%"
											></div>
										</div>
									</div>
								</td>
								<td class="text-right">
									<div class="coverage-cell">
										<span class={coverageClass(aiPct)}>
											{row.lawsWithSummaries} ({aiPct.toFixed(1)}%)
										</span>
										<div class="progress-bar">
											<div
												class="progress-fill {coverageClass(aiPct)}"
												style="width: {aiPct}%"
											></div>
										</div>
									</div>
								</td>
								<td class="text-right">
									<div class="coverage-cell">
										<span class={coverageClass(tagPct)}>
											{row.lawsWithTags} ({tagPct.toFixed(1)}%)
										</span>
										<div class="progress-bar">
											<div
												class="progress-fill {coverageClass(tagPct)}"
												style="width: {tagPct}%"
											></div>
										</div>
									</div>
								</td>
								<td class="text-right">
									<div class="coverage-cell">
										<span class={coverageClass(descPct)}>
											{row.lawsWithDescription} ({descPct.toFixed(1)}%)
										</span>
										<div class="progress-bar">
											<div
												class="progress-fill {coverageClass(descPct)}"
												style="width: {descPct}%"
											></div>
										</div>
									</div>
								</td>
								<td class="text-right">{row.totalScrutins.toLocaleString('fr-FR')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/snippet}
</AsyncCard>

<style>
	.filter-bar {
		display: flex;
		gap: 0.5rem;
		margin: 1.5rem 0;
		flex-wrap: wrap;
	}

	.filter-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-background);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.875rem;
	}

	.filter-btn:hover {
		border-color: var(--color-primary);
		background: var(--color-background-alt);
	}

	.filter-btn.active {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.table-wrapper {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.data-table th {
		text-align: left;
		padding: 0.75rem;
		border-bottom: 2px solid var(--color-border);
		font-weight: 600;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.data-table td {
		padding: 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.text-right {
		text-align: right;
	}

	.coverage-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: flex-end;
	}

	.progress-bar {
		width: 100%;
		height: 4px;
		background: var(--color-border);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		transition: width 0.3s ease;
	}

	.progress-fill.coverage-high {
		background: var(--color-success, #10b981);
	}

	.progress-fill.coverage-medium {
		background: var(--color-warning, #f59e0b);
	}

	.progress-fill.coverage-low {
		background: var(--color-danger, #ef4444);
	}

	.coverage-high {
		color: var(--color-success, #10b981);
		font-weight: 600;
	}

	.coverage-medium {
		color: var(--color-warning, #f59e0b);
		font-weight: 600;
	}

	.coverage-low {
		color: var(--color-danger, #ef4444);
		font-weight: 600;
	}

	.empty-state {
		text-align: center;
		color: var(--color-text-muted);
		padding: 2rem;
	}

	.chamber-stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1.25rem;
	}

	.chamber-stat {
		text-align: center;
	}

	.chamber-stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
		margin-bottom: 0.25rem;
	}

	.chamber-stat-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.chamber-stat .coverage-cell {
		align-items: center;
	}

	/* KPI cards */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.25rem;
		text-align: center;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-primary);
		margin-bottom: 0.5rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.data-table {
			font-size: 0.75rem;
		}

		.data-table th,
		.data-table td {
			padding: 0.5rem;
		}
	}
</style>
