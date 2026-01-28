<script lang="ts">
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
</style>
