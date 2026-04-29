<script lang="ts">
	import type { PageData } from './$types';
	import type { ETLCheckResult, ETLChamber } from '$lib/server/etl/checks';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	/** Filtre chambre actif */
	let activeChamber = $state<ETLChamber | 'ALL'>('ALL');

	/** Tri des colonnes */
	type SortKey = 'severity' | 'label' | 'chamber' | 'pct' | 'current' | 'total';
	let sortColumn = $state<SortKey>('severity');
	let sortDirection = $state<'asc' | 'desc'>('asc');

	const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2, ok: 3 };

	interface ColumnConfig {
		key: SortKey;
		label: string;
		align: 'left' | 'right';
	}

	const COLUMNS: ColumnConfig[] = [
		{ key: 'severity', label: 'Sévérité', align: 'left' },
		{ key: 'label', label: 'Label', align: 'left' },
		{ key: 'chamber', label: 'Chambre', align: 'left' },
		{ key: 'pct', label: 'Complétude', align: 'right' },
		{ key: 'current', label: 'Progression', align: 'right' }
	];

	function handleSort(col: SortKey) {
		if (sortColumn === col) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = col;
			sortDirection = 'asc';
		}
	}

	function sortChecks(checks: ETLCheckResult[]): ETLCheckResult[] {
		const mult = sortDirection === 'asc' ? 1 : -1;
		return [...checks].sort((a, b) => {
			switch (sortColumn) {
				case 'severity':
					return mult * ((SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
				case 'label':
					return mult * a.label.localeCompare(b.label, 'fr');
				case 'chamber':
					return mult * a.chamber.localeCompare(b.chamber, 'fr');
				case 'pct':
					return mult * (b.pct - a.pct);
				case 'current':
					return mult * (a.current - b.current);
				case 'total':
					return mult * (a.total - b.total);
				default:
					return 0;
			}
		});
	}

	/** Copie la commande dans le clipboard */
	function copyCommand(command: string) {
		navigator.clipboard.writeText(command);
	}

	/** Badge sévérité avec couleur appropriée */
	function getSeverityBadge(severity: string): { icon: string; color: string } {
		switch (severity) {
			case 'critical':
				return { icon: '🔴', color: 'var(--color-danger)' };
			case 'warning':
				return { icon: '🟡', color: 'var(--color-warning)' };
			case 'info':
				return { icon: '🔵', color: 'var(--color-primary)' };
			case 'ok':
				return { icon: '✅', color: 'var(--color-success)' };
			default:
				return { icon: '⚪', color: 'var(--color-text)' };
		}
	}

	/** Commande Makefile pour resynchroniser une source */
	const SYNC_COMMANDS: Record<string, string> = {
		'assemblee/actors': 'make etl-an-actors',
		'assemblee/mandates': 'make etl-an-actors',
		'assemblee/organs': 'make etl-colors',
		'assemblee/scrutins': 'make etl-an-scrutins',
		'assemblee/votes': 'make etl-an-scrutins',
		'assemblee/laws': 'make etl-an-laws',
		'europarl/meps': 'make etl-europarl-meps',
		'europarl/historical_meps': 'make etl-europarl-historical',
		'europarl/votes': 'make etl-europarl-votes',
		'europarl/activity-stats': 'make etl-europarl-activity-stats',
		'senat/senators': 'make etl-senat-senators',
		'senat/mandates-history': 'make etl-senat-mandates-history',
		'senat/activity-stats': 'make etl-senat-activity-stats',
		'nossenateurs/activity-stats': 'make etl-senat-nossenateurs-stats',
		'semantic/similar-scrutins': 'make etl-generate-similar'
	};

	function getSyncCommand(source: string, entityType: string): string | null {
		return SYNC_COMMANDS[`${source}/${entityType}`] ?? null;
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
		{#await data.syncStatus}
			<div class="skeleton" style="height: 200px;"></div>
		{:then syncRows}
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
								<th>Resynchroniser</th>
							</tr>
						</thead>
						<tbody>
							{#each syncRows as row}
								{@const cmd = getSyncCommand(row.source, row.entityType)}
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
									<td>
										{#if cmd}
											<div class="command-cell">
												<code>{cmd}</code>
												<button
													class="copy-btn"
													onclick={() => copyCommand(cmd)}
													title="Copier la commande"
													aria-label="Copier {cmd}"
												>
													📋
												</button>
											</div>
										{:else}
											<span class="no-cmd">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:catch err}
			<div class="error">
				<p>❌ Erreur lors du chargement : {err.message}</p>
			</div>
		{/await}
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

		{#await data.etlChecks}
			<div class="skeleton" style="height: 400px;"></div>
		{:then allChecks}
			{@const filtered =
				activeChamber === 'ALL'
					? allChecks
					: allChecks.filter(
							(c: ETLCheckResult) => c.chamber === activeChamber || c.chamber === 'ALL'
						)}
			{@const checks = sortChecks(filtered)}
			{#if checks.length === 0}
				<p class="empty">Aucune suggestion pour cette chambre.</p>
			{:else}
				<div class="table-wrapper">
					<table class="etl-table">
						<thead>
							<tr>
								{#each COLUMNS as col}
									<th
										class="{col.align === 'right' ? 'text-right ' : ''}sortable"
										class:sorted={sortColumn === col.key}
										aria-sort={sortColumn === col.key
											? sortDirection === 'asc'
												? 'ascending'
												: 'descending'
											: 'none'}
										tabindex="0"
										onclick={() => handleSort(col.key)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleSort(col.key);
											}
										}}
									>
										{col.label}
										{#if sortColumn === col.key}
											<span class="sort-indicator" class:desc={sortDirection === 'desc'}>▲</span>
										{/if}
									</th>
								{/each}
								<th>Commande</th>
							</tr>
						</thead>
						<tbody>
							{#each checks as check}
								{@const badge = getSeverityBadge(check.severity)}
								<tr class="row-{check.severity}">
									<td>
										<span class="severity-dot" style="color: {badge.color}" title={check.severity}
											>{badge.icon}</span
										>
									</td>
									<td>
										<span class="check-label">{check.label}</span>
										<span class="check-desc">{check.description}</span>
									</td>
									<td><span class="chamber-badge">{check.chamber}</span></td>
									<td class="text-right">
										<div class="completude-cell">
											<span>{(100 - check.pct).toFixed(1)}%</span>
											<div class="progress-mini">
												<div
													class="progress-fill severity-fill-{check.severity}"
													style="width: {Math.max(100 - check.pct, 0)}%"
												></div>
											</div>
										</div>
									</td>
									<td class="text-right number">
										{(check.total - check.current).toLocaleString('fr-FR')} / {check.total.toLocaleString(
											'fr-FR'
										)}
									</td>
									<td>
										<div class="command-cell">
											<code>{check.command}</code>
											<button
												class="copy-btn"
												onclick={() => copyCommand(check.command)}
												title="Copier la commande"
												aria-label="Copier la commande {check.command}"
											>
												📋
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:catch err}
			<div class="error">
				<p>❌ Erreur lors du chargement : {err.message}</p>
			</div>
		{/await}
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
		color: var(--color-danger);
		font-weight: 600;
	}

	.no-cmd {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
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

	/* Tableau ETL */
	.etl-table {
		width: 100%;
		border-collapse: collapse;
	}

	.etl-table th,
	.etl-table td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.etl-table th {
		font-weight: 600;
		background: var(--color-bg);
		font-size: 0.875rem;
	}

	.text-right {
		text-align: right;
	}

	.number {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* Tri */
	.sortable {
		cursor: pointer;
		user-select: none;
	}

	.sortable:hover {
		background: color-mix(in srgb, var(--color-text-muted, #888) 10%, transparent);
	}

	.sorted {
		color: var(--color-primary);
	}

	.sort-indicator {
		display: inline-block;
		font-size: 0.625rem;
		margin-left: 0.25rem;
		transition: transform 0.2s;
	}

	.sort-indicator.desc {
		transform: rotate(180deg);
	}

	/* Lignes par sévérité */
	.row-critical {
		border-left: 1px solid var(--color-danger);
		background: var(--color-danger-bg);
	}

	.row-warning {
		border-left: 1px solid var(--color-warning);
		background: var(--color-warning-bg);
	}

	.row-info {
		border-left: 1px solid var(--color-primary);
		background: var(--color-primary-bg);
	}

	.row-ok {
		border-left: 1px solid var(--color-success);
		background: var(--color-success-bg);
	}

	/* Cellules */
	.severity-dot {
		font-size: 1rem;
	}

	.check-label {
		display: block;
		font-weight: 500;
		font-size: 0.875rem;
	}

	.check-desc {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin-top: 0.125rem;
	}

	.chamber-badge {
		padding: 0.125rem 0.375rem;
		background: var(--color-surface);
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* Complétude avec mini barre */
	.completude-cell {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}

	.progress-mini {
		width: 60px;
		height: 4px;
		background: var(--color-border);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 2px;
	}

	.severity-fill-critical {
		background: var(--color-danger);
	}

	.severity-fill-warning {
		background: var(--color-warning);
	}

	.severity-fill-info {
		background: var(--color-primary);
	}

	.severity-fill-ok {
		background: var(--color-success);
	}

	/* Commande */
	.command-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.command-cell code {
		background: var(--color-surface);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.copy-btn {
		padding: 0.25rem 0.5rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
		transition: opacity 0.2s;
	}

	.copy-btn:hover {
		opacity: 0.9;
	}

	/* Skeleton & états */
	.skeleton {
		background: linear-gradient(
			90deg,
			var(--color-surface) 25%,
			var(--color-bg) 50%,
			var(--color-surface) 75%
		);
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
		background: var(--color-danger-bg);
		color: var(--color-danger-text);
		border-radius: 6px;
	}
</style>
