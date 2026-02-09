<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Filtre chambre (client-side, pas de rechargement)
	type ChamberFilter = 'ALL' | 'AN' | 'PE';
	let selectedChamber = $state<ChamberFilter>('ALL');

	// Labels des chambres
	const chamberLabels: Record<string, string> = {
		AN: 'Assemblée nationale',
		PE: 'Parlement européen',
		SENAT: 'Sénat'
	};

	/**
	 * Format legislature label selon la chambre
	 * AN-17 → "17e législature"
	 * PE-10 → "10e terme"
	 */
	function formatLegislature(legislature: string): string {
		if (legislature.startsWith('PE-')) {
			const num = legislature.replace('PE-', '');
			return `${num}e terme`;
		}
		return `${legislature}e législature`;
	}

	/**
	 * Calcule le pourcentage avec 1 décimale
	 */
	function percentage(value: number, total: number): number {
		return total > 0 ? (value / total) * 100 : 0;
	}

	/**
	 * Classe CSS selon le taux de couverture
	 * >75% → success (vert)
	 * 25-75% → warning (orange)
	 * <25% → danger (rouge)
	 */
	function coverageClass(pct: number): string {
		if (pct > 75) return 'coverage-high';
		if (pct > 25) return 'coverage-medium';
		return 'coverage-low';
	}
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
{#await data.globalStats}
	<div class="stats-grid">
		{#each Array(6) as _}
			<div class="stat-card loading">
				<div class="skeleton-value"></div>
				<div class="skeleton-label"></div>
			</div>
		{/each}
	</div>
{:then stats}
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
{/await}

<!-- Filtre chambre -->
<div class="filter-bar">
	<button
		class="filter-btn"
		class:active={selectedChamber === 'ALL'}
		onclick={() => (selectedChamber = 'ALL')}
	>
		Toutes les chambres
	</button>
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
</div>

<!-- Tableau détaillé par législature -->
<AsyncCard title="Couverture par mandature" promise={data.legislatureStats} minHeight="300px">
	{#snippet children(stats)}
		{@const filtered =
			selectedChamber === 'ALL' ? stats : stats.filter((s) => s.chamber === selectedChamber)}
		{#if filtered.length === 0}
			<p class="empty-state">Aucune donnée disponible pour ce filtre.</p>
		{:else}
			<div class="table-wrapper">
				<table class="data-table">
					<thead>
						<tr>
							<th>Mandature</th>
							<th>Chambre</th>
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
								<td>{chamberLabels[row.chamber]}</td>
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

	/* KPI cards */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
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

	.stat-card.loading {
		min-height: 100px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.5rem;
	}

	.skeleton-value {
		height: 32px;
		background: linear-gradient(
			90deg,
			var(--color-border) 25%,
			var(--color-background-alt) 50%,
			var(--color-border) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
		margin: 0 auto;
		width: 80%;
	}

	.skeleton-label {
		height: 16px;
		background: linear-gradient(
			90deg,
			var(--color-border) 25%,
			var(--color-background-alt) 50%,
			var(--color-border) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
		margin: 0 auto;
		width: 60%;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
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
