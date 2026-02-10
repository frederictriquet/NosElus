<script lang="ts">
	import type { PageData } from './$types';
	import type { ETLCheckResult, ETLChamber } from '$lib/server/etl/checks';
	import AsyncCard from '$lib/components/AsyncCard.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	/** Filtre chambre actif */
	let activeChamber = $state<ETLChamber | 'ALL'>('ALL');

	/** Checks filtrés par chambre */
	const filteredChecks = $derived.by(() => {
		const checks = data.etlChecks;
		if (checks instanceof Promise) return checks;

		if (activeChamber === 'ALL') {
			return checks;
		}
		return checks.filter((c: ETLCheckResult) => c.chamber === activeChamber || c.chamber === 'ALL');
	});

	/** Copie la commande dans le clipboard */
	function copyCommand(command: string) {
		navigator.clipboard.writeText(command);
	}

	/** Badge sévérité avec couleur appropriée */
	function getSeverityBadge(severity: string): { icon: string; color: string } {
		switch (severity) {
			case 'critical':
				return { icon: '🔴', color: 'var(--color-error)' };
			case 'warning':
				return { icon: '🟡', color: 'var(--color-warning)' };
			case 'info':
				return { icon: '🔵', color: 'var(--color-info)' };
			case 'ok':
				return { icon: '✅', color: 'var(--color-success)' };
			default:
				return { icon: '⚪', color: 'var(--color-text)' };
		}
	}

	/** Format date pour affichage */
	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('fr-FR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>État ETL - Admin - NosElus</title>
</svelte:head>

<div class="container">
	<header>
		<h1>🔄 État des ETL</h1>
		<p class="subtitle">Analyse de la base de données et suggestions d'imports</p>
	</header>

	<!-- Section 1 : Dernières synchronisations -->
	<section class="section">
		<h2>Dernières synchronisations</h2>
		<AsyncCard promise={data.syncStatus}>
			{#snippet loading()}
				<div class="skeleton" style="height: 200px;"></div>
			{/snippet}

			{#snippet success(syncRows)}
				{#if syncRows.length === 0}
					<p class="empty">Aucune synchronisation enregistrée.</p>
				{:else}
					<div class="table-wrapper">
						<table class="sync-table">
							<thead>
								<tr>
									<th>Source</th>
									<th>Type</th>
									<th>Dernier sync</th>
									<th>Status</th>
									<th>Âge</th>
									<th>Enregistrements</th>
								</tr>
							</thead>
							<tbody>
								{#each syncRows as row}
									<tr>
										<td><code>{row.source}</code></td>
										<td>{row.entityType}</td>
										<td>{formatDate(row.lastSyncAt)}</td>
										<td>
											<span class="badge badge-{row.lastSyncStatus}">
												{row.lastSyncStatus === 'success' ? '✅' : '⚠️'}
												{row.lastSyncStatus}
											</span>
										</td>
										<td>
											<span class:stale={row.daysSinceSync > 30}>
												{row.daysSinceSync}j
											</span>
										</td>
										<td class="number">{row.recordsProcessed.toLocaleString('fr-FR')}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/snippet}

			{#snippet error(err)}
				<div class="error">
					<p>❌ Erreur lors du chargement : {err.message}</p>
				</div>
			{/snippet}
		</AsyncCard>
	</section>

	<!-- Section 2 : Suggestions ETL -->
	<section class="section">
		<div class="section-header">
			<h2>Suggestions d'ETL</h2>
			<div class="filters" role="toolbar" aria-label="Filtrer par chambre">
				<button
					class="filter-btn"
					class:active={activeChamber === 'ALL'}
					onclick={() => (activeChamber = 'ALL')}
				>
					Toutes
				</button>
				<button
					class="filter-btn"
					class:active={activeChamber === 'AN'}
					onclick={() => (activeChamber = 'AN')}
				>
					AN
				</button>
				<button
					class="filter-btn"
					class:active={activeChamber === 'PE'}
					onclick={() => (activeChamber = 'PE')}
				>
					PE
				</button>
				<button
					class="filter-btn"
					class:active={activeChamber === 'SENAT'}
					onclick={() => (activeChamber = 'SENAT')}
				>
					Sénat
				</button>
			</div>
		</div>

		<AsyncCard promise={filteredChecks}>
			{#snippet loading()}
				<div class="skeleton" style="height: 400px;"></div>
			{/snippet}

			{#snippet success(checks)}
				{#if checks.length === 0}
					<p class="empty">Aucune suggestion pour cette chambre.</p>
				{:else}
					<div class="checks-list">
						{#each checks as check}
							{@const badge = getSeverityBadge(check.severity)}
							<div class="check-card severity-{check.severity}">
								<div class="check-header">
									<div class="check-title">
										<span class="severity-icon" style="color: {badge.color}">{badge.icon}</span>
										<h3>{check.label}</h3>
										<span class="chamber-badge">{check.chamber}</span>
									</div>
									<div class="check-stats">
										<span class="pct">{check.pct.toFixed(1)}%</span>
										<span class="counts">
											{check.current.toLocaleString('fr-FR')} / {check.total.toLocaleString(
												'fr-FR'
											)}
										</span>
									</div>
								</div>

								<p class="check-description">{check.description}</p>

								<div class="check-action">
									<code class="command">{check.command}</code>
									<button
										class="copy-btn"
										onclick={() => copyCommand(check.command)}
										title="Copier la commande"
										aria-label="Copier la commande {check.command}"
									>
										📋 Copier
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/snippet}

			{#snippet error(err)}
				<div class="error">
					<p>❌ Erreur lors du chargement : {err.message}</p>
				</div>
			{/snippet}
		</AsyncCard>
	</section>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	header {
		margin-bottom: 3rem;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		color: var(--color-text-secondary);
		font-size: 1rem;
	}

	.section {
		margin-bottom: 3rem;
		background: var(--color-surface);
		border-radius: 8px;
		padding: 1.5rem;
	}

	.section h2 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	/* Filtres */
	.filters {
		display: flex;
		gap: 0.5rem;
	}

	.filter-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.filter-btn:hover {
		background: var(--color-surface);
	}

	.filter-btn.active {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	/* Tableau sync */
	.table-wrapper {
		overflow-x: auto;
	}

	.sync-table {
		width: 100%;
		border-collapse: collapse;
	}

	.sync-table th,
	.sync-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.sync-table th {
		font-weight: 600;
		background: var(--color-bg);
	}

	.sync-table code {
		background: var(--color-bg);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.sync-table .number {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.stale {
		color: var(--color-error);
		font-weight: 600;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.badge-success {
		background: var(--color-success-bg, #d4edda);
		color: var(--color-success, #155724);
	}

	/* Checks list */
	.checks-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.check-card {
		padding: 1.5rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-bg);
	}

	.check-card.severity-critical {
		border-left: 4px solid var(--color-error);
	}

	.check-card.severity-warning {
		border-left: 4px solid var(--color-warning);
	}

	.check-card.severity-info {
		border-left: 4px solid var(--color-info);
	}

	.check-card.severity-ok {
		border-left: 4px solid var(--color-success);
	}

	.check-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.check-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.severity-icon {
		font-size: 1.25rem;
	}

	.check-title h3 {
		font-size: 1.125rem;
		margin: 0;
	}

	.chamber-badge {
		padding: 0.25rem 0.5rem;
		background: var(--color-surface);
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.check-stats {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}

	.check-stats .pct {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.check-stats .counts {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.check-description {
		margin: 0.75rem 0;
		color: var(--color-text-secondary);
		font-size: 0.938rem;
	}

	.check-action {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.command {
		flex: 1;
		background: var(--color-surface);
		padding: 0.75rem 1rem;
		border-radius: 6px;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
	}

	.copy-btn {
		padding: 0.75rem 1.25rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
		transition: opacity 0.2s;
	}

	.copy-btn:hover {
		opacity: 0.9;
	}

	/* Skeleton & états */
	.skeleton {
		background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-bg) 50%, var(--color-surface) 75%);
		background-size: 200% 100%;
		animation: loading 1.5s infinite;
		border-radius: 8px;
	}

	@keyframes loading {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.empty {
		padding: 2rem;
		text-align: center;
		color: var(--color-text-secondary);
	}

	.error {
		padding: 1rem;
		background: var(--color-error-bg, #f8d7da);
		color: var(--color-error, #721c24);
		border-radius: 6px;
	}
</style>
