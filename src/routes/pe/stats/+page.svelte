<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Statistiques PE - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Statistiques</h1>
	<p class="page-subtitle">Analyse de l'activité au Parlement européen (eurodéputés français)</p>
</div>

{#await data.totals}
	<div class="stats-grid">
		{#each Array(4) as _}
			<div class="stat-card loading">
				<div class="skeleton-value"></div>
				<div class="skeleton-label"></div>
			</div>
		{/each}
	</div>
{:then totals}
	{#await data.scrutinResults then scrutinResults}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{totals.actors}</div>
				<div class="stat-label">Eurodéputés français</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{totals.scrutins.toLocaleString('fr-FR')}</div>
				<div class="stat-label">Scrutins</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{totals.votes.toLocaleString('fr-FR')}</div>
				<div class="stat-label">Votes enregistrés</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{scrutinResults.adopté + scrutinResults.rejeté > 0 ? ((scrutinResults.adopté / (scrutinResults.adopté + scrutinResults.rejeté)) * 100).toFixed(0) : 0}%</div>
				<div class="stat-label">Taux d'adoption</div>
			</div>
		</div>
	{/await}
{/await}

<div class="card-grid">
	<AsyncCard title="Répartition des votes" promise={data.distribution} minHeight="180px">
		{#snippet children(distribution)}
			{@const totalDistribution = distribution.pour + distribution.contre + distribution.abstention + (distribution['non-votant'] || 0)}
			{#if totalDistribution > 0}
				<div class="vote-bar" style="height: 32px; border-radius: 16px; margin: 1.5rem 0;">
					<div class="vote-bar-for" style="width: {(distribution.pour / totalDistribution) * 100}%"></div>
					<div class="vote-bar-against" style="width: {(distribution.contre / totalDistribution) * 100}%"></div>
					<div class="vote-bar-abstention" style="width: {(distribution.abstention / totalDistribution) * 100}%"></div>
					{#if distribution['non-votant'] > 0}
						<div class="vote-bar-nonvotant" style="width: {(distribution['non-votant'] / totalDistribution) * 100}%"></div>
					{/if}
				</div>
				<div style="display: flex; justify-content: space-around; text-align: center;">
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">{((distribution.pour / totalDistribution) * 100).toFixed(1)}%</div>
						<div style="color: var(--color-text-muted);">Pour ({distribution.pour.toLocaleString('fr-FR')})</div>
					</div>
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-danger);">{((distribution.contre / totalDistribution) * 100).toFixed(1)}%</div>
						<div style="color: var(--color-text-muted);">Contre ({distribution.contre.toLocaleString('fr-FR')})</div>
					</div>
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">{((distribution.abstention / totalDistribution) * 100).toFixed(1)}%</div>
						<div style="color: var(--color-text-muted);">Abstention ({distribution.abstention.toLocaleString('fr-FR')})</div>
					</div>
					{#if distribution['non-votant'] > 0}
						<div>
							<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-text-muted);">{((distribution['non-votant'] / totalDistribution) * 100).toFixed(1)}%</div>
							<div style="color: var(--color-text-muted);">Non-votants ({distribution['non-votant'].toLocaleString('fr-FR')})</div>
						</div>
					{/if}
				</div>
			{:else}
				<p class="empty-state">Aucune donnée de vote</p>
			{/if}
		{/snippet}
	</AsyncCard>

	<AsyncCard title="Résultats des scrutins" promise={data.scrutinResults} minHeight="120px">
		{#snippet children(scrutinResults)}
			{@const totalResults = scrutinResults.adopté + scrutinResults.rejeté}
			{#if totalResults > 0}
				<div class="results-chart">
					<div class="result-bar adopted" style="width: {(scrutinResults.adopté / totalResults) * 100}%">
						<span>{scrutinResults.adopté}</span>
					</div>
					<div class="result-bar rejected" style="width: {(scrutinResults.rejeté / totalResults) * 100}%">
						<span>{scrutinResults.rejeté}</span>
					</div>
				</div>
				<div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.875rem; color: var(--color-text-muted);">
					<span>Adoptés</span>
					<span>Rejetés</span>
				</div>
			{:else}
				<p class="empty-state">Aucun scrutin</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Activité par mois" promise={data.monthlyActivity} minHeight="180px">
		{#snippet children(monthlyActivity)}
			{#if monthlyActivity.length > 0}
				<div class="activity-chart">
					{#each monthlyActivity.slice(-12) as month}
						{@const maxCount = Math.max(...monthlyActivity.map(m => m.count))}
						<div class="activity-bar-container">
							<div class="activity-bar" style="height: {(month.count / maxCount) * 100}%"></div>
							<span class="activity-label">{month.month.slice(5)}</span>
							<span class="activity-value">{month.count}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-state">Aucune donnée d'activité</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Top 10 - Participation aux votes" promise={data.topParticipation} minHeight="400px">
		{#snippet children(topParticipation)}
			{#if topParticipation.length > 0}
				<div class="ranking-list">
					{#each topParticipation as mep, i}
						<ElectedCard
							id={mep.id}
							name={mep.name}
							photoUrl={mep.photoUrl}
							variant="inline"
							type="eurodepute"
							rank={i + 1}
							stat="{mep.voteCount} votes"
							group={mep.group}
						/>
					{/each}
				</div>
			{:else}
				<p class="empty-state">Aucune donnée de participation</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Votes par groupe politique" promise={data.groupStats} minHeight="300px">
		{#snippet children(groupStats)}
			{@const filteredGroups = groupStats.filter(g => g.totalVotes > 0)}
			{#if filteredGroups.length > 0}
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
							{#each filteredGroups as group}
								<tr>
									<td>
										<a href="/pe/groupes/{group.groupId}" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: inherit;">
											<span style="width: 12px; height: 12px; border-radius: 50%; background: {group.groupColor || '#ccc'}"></span>
											<span>{group.groupShortName || group.groupName}</span>
										</a>
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
			{:else}
				<p class="empty-state">Aucune donnée de groupe</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Proximité politique entre groupes" subtitle="Pourcentage de votes identiques entre les groupes européens (sur les 15 derniers scrutins)" promise={data.heatmapAndProximity} minHeight="250px">
		{#snippet children(heatmapAndProximity)}
			{@const proximityMatrix = heatmapAndProximity.proximityMatrix}
			{#if proximityMatrix.groups.length > 1}
				<div class="proximity-matrix">
					<table class="matrix-table">
						<thead>
							<tr>
								<th></th>
								{#each proximityMatrix.groups as group}
									<th class="matrix-header" title={group.name}>
										<span class="group-dot" style="background: {group.color || '#888'}"></span>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each proximityMatrix.groups as rowGroup}
								<tr>
									<td class="matrix-row-header">
										<span class="group-dot" style="background: {rowGroup.color || '#888'}"></span>
										<span class="group-abbr">{rowGroup.name}</span>
									</td>
									{#each proximityMatrix.groups as colGroup}
										{@const value = proximityMatrix.matrix[rowGroup.id]?.[colGroup.id] ?? 0}
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
			{:else}
				<p class="empty-state">Données insuffisantes</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Heatmap des votes récents" subtitle="Position majoritaire de chaque groupe sur les 15 derniers scrutins" promise={data.heatmapAndProximity} minHeight="350px">
		{#snippet children(heatmapAndProximity)}
			{@const heatmap = heatmapAndProximity.heatmap}
			{#if heatmap.scrutins.length > 0 && heatmap.groups.length > 0}
				<div class="heatmap-container">
					<table class="heatmap-table">
						<thead>
							<tr>
								<th class="heatmap-scrutin-header">Scrutin</th>
								{#each heatmap.groups as group}
									<th class="heatmap-group-header" title={group.name}>
										<span class="group-dot" style="background: {group.color || '#888'}"></span>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each heatmap.scrutins as scrutin}
								<tr>
									<td class="heatmap-scrutin-cell">
										<a href="/pe/scrutins/{scrutin.id}" title={scrutin.title}>
											{scrutin.title?.slice(0, 40)}{(scrutin.title?.length || 0) > 40 ? '...' : ''}
										</a>
										<span class="scrutin-date">{new Date(scrutin.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
									</td>
									{#each heatmap.groups as group}
										{@const vote = heatmap.matrix[scrutin.id]?.[group.id]}
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
			{:else}
				<p class="empty-state">Aucune donnée de vote</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Évolution des positions dans le temps" subtitle="Répartition des votes par mois" promise={data.positionEvolution} minHeight="250px">
		{#snippet children(positionEvolution)}
			{#if positionEvolution.length > 0}
				<div class="evolution-timeline">
					{#each positionEvolution.slice(-12) as month}
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
			{:else}
				<p class="empty-state">Aucune donnée d'évolution</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<style>
	/* Skeleton loading */
	.stat-card.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.skeleton-value {
		width: 80px;
		height: 32px;
		background: linear-gradient(90deg, var(--color-border) 25%, var(--color-bg) 50%, var(--color-border) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}

	.skeleton-label {
		width: 60px;
		height: 16px;
		background: linear-gradient(90deg, var(--color-border) 25%, var(--color-bg) 50%, var(--color-border) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
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

	.result-bar.adopted { background: var(--color-success); }
	.result-bar.rejected { background: var(--color-danger); }

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
		gap: 0.25rem;
	}

	/* Proximity Matrix */
	.proximity-matrix { overflow-x: auto; }

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

	.matrix-cell.diagonal { background: var(--color-border); color: var(--color-text-muted); }
	.matrix-cell.high { background: #dcfce7; color: #166534; }
	.matrix-cell.medium { background: #fef3c7; color: #92400e; }
	.matrix-cell.low { background: #fee2e2; color: #991b1b; }

	/* Heatmap */
	.heatmap-container { overflow-x: auto; }

	.heatmap-table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.8rem;
	}

	.heatmap-scrutin-header { text-align: left; padding: 0.5rem; min-width: 200px; }
	.heatmap-group-header { padding: 0.5rem; text-align: center; }

	.heatmap-scrutin-cell { padding: 0.5rem; max-width: 250px; }
	.heatmap-scrutin-cell a { font-size: 0.75rem; line-height: 1.3; display: block; color: inherit; }
	.scrutin-date { font-size: 0.65rem; color: var(--color-text-muted); }

	.heatmap-cell {
		text-align: center;
		padding: 0.5rem;
		font-weight: 700;
		min-width: 40px;
	}

	.heatmap-cell.pour { background: #dcfce7; color: #166534; }
	.heatmap-cell.contre { background: #fee2e2; color: #991b1b; }
	.heatmap-cell.abstention { background: #fef3c7; color: #92400e; }
	.heatmap-cell.empty { background: var(--color-bg); color: var(--color-text-muted); }

	.heatmap-legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		font-size: 0.75rem;
	}

	.heatmap-legend .legend-box { width: 16px; height: 16px; border-radius: 4px; }
	.heatmap-legend .legend-box.pour { background: #dcfce7; }
	.heatmap-legend .legend-box.contre { background: #fee2e2; }
	.heatmap-legend .legend-box.abstention { background: #fef3c7; }

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

	.timeline-segment { width: 100%; }
	.timeline-segment.pour { background: var(--color-success); }
	.timeline-segment.contre { background: var(--color-danger); }
	.timeline-segment.abstention { background: var(--color-warning); }

	.timeline-label {
		position: absolute;
		bottom: -1.25rem;
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}
</style>
