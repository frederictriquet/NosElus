<script lang="ts">
	import PeriodFilter from '$lib/components/PeriodFilter.svelte';

	let { data } = $props();

	const totalDistribution = data.distribution.pour + data.distribution.contre + data.distribution.abstention;
</script>

<svelte:head>
	<title>Statistiques - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Statistiques</h1>
	<p class="page-subtitle">Analyse de l'activité parlementaire</p>
</div>

<div class="filters" style="margin-bottom: 1.5rem;">
	<PeriodFilter
		legislature={data.filters.legislature}
		dateFrom={data.filters.dateFrom}
		dateTo={data.filters.dateTo}
		showDateRange={true}
	/>
</div>

<div class="stats-grid">
	<div class="stat-card">
		<div class="stat-value">{data.totals.actors}</div>
		<div class="stat-label">Députés</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{data.totals.scrutins.toLocaleString('fr-FR')}</div>
		<div class="stat-label">Scrutins</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{data.totals.votes.toLocaleString('fr-FR')}</div>
		<div class="stat-label">Votes enregistrés</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{((data.scrutinResults.adopté / (data.scrutinResults.adopté + data.scrutinResults.rejeté)) * 100).toFixed(0)}%</div>
		<div class="stat-label">Taux d'adoption</div>
	</div>
</div>

<div class="card-grid">
	<section class="card">
		<h2>Répartition des votes</h2>
		{#if totalDistribution > 0}
			<div class="vote-bar" style="height: 32px; border-radius: 16px; margin: 1.5rem 0;">
				<div class="vote-bar-for" style="width: {(data.distribution.pour / totalDistribution) * 100}%"></div>
				<div class="vote-bar-against" style="width: {(data.distribution.contre / totalDistribution) * 100}%"></div>
				<div class="vote-bar-abstention" style="width: {(data.distribution.abstention / totalDistribution) * 100}%"></div>
			</div>
			<div style="display: flex; justify-content: space-around; text-align: center;">
				<div>
					<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">{((data.distribution.pour / totalDistribution) * 100).toFixed(1)}%</div>
					<div style="color: var(--color-text-muted);">Pour ({data.distribution.pour.toLocaleString('fr-FR')})</div>
				</div>
				<div>
					<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-danger);">{((data.distribution.contre / totalDistribution) * 100).toFixed(1)}%</div>
					<div style="color: var(--color-text-muted);">Contre ({data.distribution.contre.toLocaleString('fr-FR')})</div>
				</div>
				<div>
					<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">{((data.distribution.abstention / totalDistribution) * 100).toFixed(1)}%</div>
					<div style="color: var(--color-text-muted);">Abstention ({data.distribution.abstention.toLocaleString('fr-FR')})</div>
				</div>
			</div>
		{:else}
			<p class="empty-state">Aucune donnée de vote</p>
		{/if}
	</section>

	<section class="card">
		<h2>Résultats des scrutins</h2>
		<div class="results-chart">
			<div class="result-bar adopted" style="width: {(data.scrutinResults.adopté / (data.scrutinResults.adopté + data.scrutinResults.rejeté)) * 100}%">
				<span>{data.scrutinResults.adopté}</span>
			</div>
			<div class="result-bar rejected" style="width: {(data.scrutinResults.rejeté / (data.scrutinResults.adopté + data.scrutinResults.rejeté)) * 100}%">
				<span>{data.scrutinResults.rejeté}</span>
			</div>
		</div>
		<div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.875rem; color: var(--color-text-muted);">
			<span>Adoptés</span>
			<span>Rejetés</span>
		</div>
	</section>
</div>

<section class="card" style="margin-top: 1.5rem;">
	<h2>Activité par mois</h2>
	<div class="activity-chart">
		{#each data.monthlyActivity.slice(-12) as month}
			{@const maxCount = Math.max(...data.monthlyActivity.map(m => m.count))}
			<div class="activity-bar-container">
				<div class="activity-bar" style="height: {(month.count / maxCount) * 100}%"></div>
				<span class="activity-label">{month.month.slice(5)}</span>
				<span class="activity-value">{month.count}</span>
			</div>
		{/each}
	</div>
</section>

<section class="card" style="margin-top: 1.5rem;">
	<h2>Top 10 - Participation aux votes</h2>
	<div class="ranking-list">
		{#each data.topParticipation as deputy, i}
			<a href="/deputes/{deputy.id}" class="ranking-item">
				<span class="ranking-position">{i + 1}</span>
				<img src={deputy.photoUrl || '/placeholder.png'} alt={deputy.name} class="ranking-photo" />
				<span class="ranking-name">{deputy.name}</span>
				<span class="ranking-value">{deputy.voteCount} votes</span>
			</a>
		{/each}
	</div>
</section>

<section class="card" style="margin-top: 1.5rem;">
	<h2>Votes par groupe parlementaire</h2>
	<div class="table-container">
		<table>
			<thead>
				<tr>
					<th>Groupe</th>
					<th style="text-align: right;">Pour</th>
					<th style="text-align: right;">Contre</th>
					<th style="text-align: right;">Abstention</th>
					<th style="text-align: right;">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each data.groupStats.filter(g => g.totalVotes > 0) as group}
					<tr>
						<td>
							<div style="display: flex; align-items: center; gap: 0.5rem;">
								<span style="width: 12px; height: 12px; border-radius: 50%; background: {group.groupColor || '#ccc'}"></span>
								<span>{group.groupShortName || group.groupName}</span>
							</div>
						</td>
						<td style="text-align: right; color: var(--color-success);">{group.pourVotes.toLocaleString('fr-FR')}</td>
						<td style="text-align: right; color: var(--color-danger);">{group.contreVotes.toLocaleString('fr-FR')}</td>
						<td style="text-align: right; color: var(--color-warning);">{group.abstentionVotes.toLocaleString('fr-FR')}</td>
						<td style="text-align: right; font-weight: 600;">{group.totalVotes.toLocaleString('fr-FR')}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

{#if data.proximityMatrix.groups.length > 1}
<section class="card" style="margin-top: 1.5rem;">
	<h2>Proximité politique entre groupes</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Pourcentage de votes identiques entre les groupes parlementaires (sur les 15 derniers scrutins)
	</p>
	<div class="proximity-matrix">
		<table class="matrix-table">
			<thead>
				<tr>
					<th></th>
					{#each data.proximityMatrix.groups as group}
						<th class="matrix-header" title={group.name}>
							<span class="group-dot" style="background: {group.color || '#888'}"></span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.proximityMatrix.groups as rowGroup}
					<tr>
						<td class="matrix-row-header">
							<span class="group-dot" style="background: {rowGroup.color || '#888'}"></span>
							<span class="group-abbr">{rowGroup.name}</span>
						</td>
						{#each data.proximityMatrix.groups as colGroup}
							{@const value = data.proximityMatrix.matrix[rowGroup.id]?.[colGroup.id] ?? 0}
							<td
								class="matrix-cell"
								class:diagonal={rowGroup.id === colGroup.id}
								class:high={value >= 70 && rowGroup.id !== colGroup.id}
								class:medium={value >= 40 && value < 70}
								class:low={value < 40 && rowGroup.id !== colGroup.id}
								title="{rowGroup.name} / {colGroup.name}: {value}%"
							>
								{rowGroup.id === colGroup.id ? '-' : value + '%'}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
{/if}

{#if data.heatmap.scrutins.length > 0 && data.heatmap.groups.length > 0}
<section class="card" style="margin-top: 1.5rem;">
	<h2>Heatmap des votes récents</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Position majoritaire de chaque groupe sur les 15 derniers scrutins
	</p>
	<div class="heatmap-container">
		<table class="heatmap-table">
			<thead>
				<tr>
					<th class="heatmap-scrutin-header">Scrutin</th>
					{#each data.heatmap.groups as group}
						<th class="heatmap-group-header" title={group.name}>
							<span class="group-dot" style="background: {group.color || '#888'}"></span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.heatmap.scrutins as scrutin}
					<tr>
						<td class="heatmap-scrutin-cell">
							<a href="/scrutins/{scrutin.id}" title={scrutin.title}>
								{scrutin.title?.slice(0, 40)}{(scrutin.title?.length || 0) > 40 ? '...' : ''}
							</a>
							<span class="scrutin-date">{new Date(scrutin.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
						</td>
						{#each data.heatmap.groups as group}
							{@const vote = data.heatmap.matrix[scrutin.id]?.[group.id]}
							<td
								class="heatmap-cell"
								class:pour={vote?.position === 'pour'}
								class:contre={vote?.position === 'contre'}
								class:abstention={vote?.position === 'abstention'}
								class:empty={!vote}
								title="{group.name}: {vote?.position || 'non voté'}"
							>
								{#if vote?.position === 'pour'}✓
								{:else if vote?.position === 'contre'}✗
								{:else if vote?.position === 'abstention'}○
								{:else}-{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="heatmap-legend">
		<span class="legend-item"><span class="legend-box pour"></span> Pour</span>
		<span class="legend-item"><span class="legend-box contre"></span> Contre</span>
		<span class="legend-item"><span class="legend-box abstention"></span> Abstention</span>
	</div>
</section>
{/if}

{#if data.governmentAlignment.length > 0}
<section class="card" style="margin-top: 1.5rem;">
	<h2>Alignement avec le gouvernement</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Taux d'alignement avec la majorité présidentielle (Renaissance, MoDem, Horizons)
	</p>
	<div class="alignment-list">
		{#each data.governmentAlignment as group}
			<div class="alignment-item">
				<div class="alignment-group">
					<span class="group-dot" style="background: {group.groupColor || '#888'}"></span>
					<span class="alignment-name">{group.groupShortName || group.groupName}</span>
				</div>
				<div class="alignment-bar-container">
					<div
						class="alignment-bar"
						class:high={group.alignmentRate >= 70}
						class:medium={group.alignmentRate >= 40 && group.alignmentRate < 70}
						class:low={group.alignmentRate < 40}
						style="width: {group.alignmentRate}%"
					></div>
				</div>
				<span class="alignment-value" class:high={group.alignmentRate >= 70} class:medium={group.alignmentRate >= 40 && group.alignmentRate < 70} class:low={group.alignmentRate < 40}>
					{group.alignmentRate.toFixed(0)}%
				</span>
			</div>
		{/each}
	</div>
</section>
{/if}

{#if data.positionEvolution.length > 0}
<section class="card" style="margin-top: 1.5rem;">
	<h2>Évolution des positions dans le temps</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Répartition des votes par mois
	</p>
	<div class="evolution-timeline">
		{#each data.positionEvolution.slice(-12) as month}
			{@const pourPct = month.total > 0 ? (month.pour / month.total) * 100 : 0}
			{@const contrePct = month.total > 0 ? (month.contre / month.total) * 100 : 0}
			{@const abstPct = month.total > 0 ? (month.abstention / month.total) * 100 : 0}
			<div class="timeline-column" title="{month.month}: {month.total} votes">
				<div class="timeline-bar">
					<div class="timeline-segment pour" style="height: {pourPct}%"></div>
					<div class="timeline-segment contre" style="height: {contrePct}%"></div>
					<div class="timeline-segment abstention" style="height: {abstPct}%"></div>
				</div>
				<span class="timeline-label">{month.month.slice(5)}</span>
			</div>
		{/each}
	</div>
	<div class="evolution-legend" style="margin-top: 1rem;">
		<span class="legend-item"><span class="legend-box pour"></span> Pour</span>
		<span class="legend-item"><span class="legend-box contre"></span> Contre</span>
		<span class="legend-item"><span class="legend-box abstention"></span> Abstention</span>
	</div>
</section>
{/if}

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.results-chart {
		display: flex;
		height: 48px;
		border-radius: 8px;
		overflow: hidden;
		margin-top: 1rem;
	}

	.result-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 600;
		font-size: 1.25rem;
		min-width: 60px;
	}

	.result-bar.adopted {
		background: var(--color-success);
	}

	.result-bar.rejected {
		background: var(--color-danger);
	}

	.activity-chart {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		height: 150px;
		margin-top: 1rem;
		padding-bottom: 2rem;
	}

	.activity-bar-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		position: relative;
	}

	.activity-bar {
		width: 100%;
		background: var(--color-primary);
		border-radius: 4px 4px 0 0;
		min-height: 4px;
		margin-top: auto;
	}

	.activity-label {
		position: absolute;
		bottom: -1.5rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.activity-value {
		position: absolute;
		bottom: 100%;
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.ranking-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ranking-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
		transition: background 0.2s;
	}

	.ranking-item:hover {
		background: var(--color-bg);
		text-decoration: none;
	}

	.ranking-position {
		width: 24px;
		text-align: center;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.ranking-photo {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--color-border);
	}

	.ranking-name {
		flex: 1;
		font-weight: 500;
	}

	.ranking-value {
		color: var(--color-primary);
		font-weight: 600;
	}

	/* Proximity Matrix */
	.proximity-matrix {
		overflow-x: auto;
	}

	.matrix-table {
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.matrix-header {
		padding: 0.5rem;
		text-align: center;
	}

	.matrix-row-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		white-space: nowrap;
	}

	.group-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		display: inline-block;
		flex-shrink: 0;
	}

	.group-abbr {
		font-weight: 500;
		font-size: 0.75rem;
	}

	.matrix-cell {
		padding: 0.5rem;
		text-align: center;
		font-weight: 600;
		min-width: 50px;
	}

	.matrix-cell.diagonal {
		background: var(--color-border);
		color: var(--color-text-muted);
	}

	.matrix-cell.high {
		background: #dcfce7;
		color: #166534;
	}

	.matrix-cell.medium {
		background: #fef3c7;
		color: #92400e;
	}

	.matrix-cell.low {
		background: #fee2e2;
		color: #991b1b;
	}

	/* Heatmap */
	.heatmap-container {
		overflow-x: auto;
	}

	.heatmap-table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.8rem;
	}

	.heatmap-scrutin-header {
		text-align: left;
		padding: 0.5rem;
		min-width: 200px;
	}

	.heatmap-group-header {
		padding: 0.5rem;
		text-align: center;
	}

	.heatmap-scrutin-cell {
		padding: 0.5rem;
		max-width: 250px;
	}

	.heatmap-scrutin-cell a {
		font-size: 0.75rem;
		line-height: 1.3;
		display: block;
		color: inherit;
	}

	.scrutin-date {
		font-size: 0.65rem;
		color: var(--color-text-muted);
	}

	.heatmap-cell {
		text-align: center;
		padding: 0.5rem;
		font-weight: 700;
		min-width: 40px;
	}

	.heatmap-cell.pour {
		background: #dcfce7;
		color: #166534;
	}

	.heatmap-cell.contre {
		background: #fee2e2;
		color: #991b1b;
	}

	.heatmap-cell.abstention {
		background: #fef3c7;
		color: #92400e;
	}

	.heatmap-cell.empty {
		background: var(--color-bg);
		color: var(--color-text-muted);
	}

	.heatmap-legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		font-size: 0.75rem;
	}

	/* Override legend-box size for heatmap */
	.heatmap-legend .legend-box {
		width: 16px;
		height: 16px;
		border-radius: 4px;
	}

	.heatmap-legend .legend-box.pour {
		background: #dcfce7;
	}

	.heatmap-legend .legend-box.contre {
		background: #fee2e2;
	}

	.heatmap-legend .legend-box.abstention {
		background: #fef3c7;
	}

	/* Government Alignment */
	.alignment-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.alignment-item {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.alignment-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 80px;
	}

	.alignment-name {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.alignment-bar-container {
		flex: 1;
		height: 20px;
		background: var(--color-bg);
		border-radius: 10px;
		overflow: hidden;
	}

	.alignment-bar {
		height: 100%;
		border-radius: 10px;
		transition: width 0.3s ease;
	}

	.alignment-bar.high {
		background: var(--color-success);
	}

	.alignment-bar.medium {
		background: var(--color-warning);
	}

	.alignment-bar.low {
		background: var(--color-danger);
	}

	.alignment-value {
		min-width: 45px;
		text-align: right;
		font-weight: 700;
		font-size: 0.875rem;
	}

	.alignment-value.high {
		color: var(--color-success);
	}

	.alignment-value.medium {
		color: var(--color-warning);
	}

	.alignment-value.low {
		color: var(--color-danger);
	}

	/* Evolution Timeline */
	.evolution-timeline {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		height: 200px;
		padding-bottom: 1.5rem;
	}

	.timeline-column {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		position: relative;
	}

	.timeline-bar {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column-reverse;
		border-radius: 4px 4px 0 0;
		overflow: hidden;
	}

	.timeline-segment {
		width: 100%;
	}

	.timeline-segment.pour {
		background: var(--color-success);
	}

	.timeline-segment.contre {
		background: var(--color-danger);
	}

	.timeline-segment.abstention {
		background: var(--color-warning);
	}

	.timeline-label {
		position: absolute;
		bottom: -1.25rem;
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}
</style>
