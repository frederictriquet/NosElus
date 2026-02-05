<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ElectedCard from '$lib/components/ElectedCard.svelte';
	import VoteDistributionCard from '$lib/components/VoteDistributionCard.svelte';
	import VoteEvolutionChart from '$lib/components/VoteEvolutionChart.svelte';
	import GroupCohesionChart from '$lib/components/GroupCohesionChart.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.group.name} - NosElus</title>
</svelte:head>

<div class="page-header">
	<div style="display: flex; align-items: center; gap: 1rem;">
		<div class="group-color" style="background: {data.group.color || '#ccc'}"></div>
		<div>
			<h1 class="page-title">{data.group.name}</h1>
			<p class="page-subtitle">{data.group.shortName}</p>
		</div>
	</div>
</div>

{#await data.distributionData}
	<div class="stats-grid" style="margin-bottom: 1.5rem;">
		{#each Array(3) as _}
			<div class="stat-card loading">
				<div class="skeleton-value"></div>
				<div class="skeleton-label"></div>
			</div>
		{/each}
	</div>
{:then distributionData}
	{@const totalVotes =
		distributionData.distribution.pour +
		distributionData.distribution.contre +
		distributionData.distribution.abstention}
	<div class="stats-grid" style="margin-bottom: 1.5rem;">
		<div class="stat-card">
			<div class="stat-value">{distributionData.totalVotes.toLocaleString('fr-FR')}</div>
			<div class="stat-label">Votes enregistrés</div>
		</div>
		<div class="stat-card">
			<div class="stat-value" style="color: var(--color-success);">
				{totalVotes > 0 ? ((distributionData.distribution.pour / totalVotes) * 100).toFixed(0) : 0}%
			</div>
			<div class="stat-label">Votes pour</div>
		</div>
		<div class="stat-card">
			<div class="stat-value" style="color: var(--color-danger);">
				{totalVotes > 0
					? ((distributionData.distribution.contre / totalVotes) * 100).toFixed(0)
					: 0}%
			</div>
			<div class="stat-label">Votes contre</div>
		</div>
	</div>
{/await}

{#await data.members}
	<section class="card">
		<h2>Députés les plus actifs</h2>
		<div class="loading-state">Chargement...</div>
	</section>
{:then members}
	<section class="card">
		<h2>Députés les plus actifs ({members.length})</h2>
		{#if members.length === 0}
			<p class="empty-state">Aucun député trouvé</p>
		{:else}
			<div class="members-list">
				{#each members as member, i}
					<ElectedCard
						id={member.id}
						name={member.name}
						photoUrl={member.photoUrl}
						variant="inline"
						rank={i + 1}
						stat="{member.voteCount} votes"
					/>
				{/each}
			</div>
		{/if}
	</section>
{:catch}
	<section class="card">
		<h2>Députés les plus actifs</h2>
		<p class="empty-state">Erreur de chargement</p>
	</section>
{/await}

<div style="margin-top: 1.5rem;">
	{#await data.distributionData then distributionData}
		<VoteDistributionCard distribution={distributionData.distribution} />
	{/await}
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Évolution des votes" promise={data.monthlyActivity} minHeight="200px">
		{#snippet children(monthlyActivity)}
			<VoteEvolutionChart
				data={monthlyActivity}
				periodStart={data.periodDates?.start}
				periodEnd={data.periodDates?.end}
			/>
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Cohésion du groupe" promise={data.cohesionData} minHeight="200px">
		{#snippet children(cohesionData)}
			<GroupCohesionChart
				data={cohesionData}
				periodStart={data.periodDates?.start}
				periodEnd={data.periodDates?.end}
			/>
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard
		title="Votes les plus divisifs"
		subtitle="Scrutins avec forte division interne"
		promise={data.divisiveVotes}
		minHeight="300px"
	>
		{#snippet children(votes)}
			{#if votes && votes.length > 0}
				<div class="divisive-votes-list">
					{#each votes as vote}
						<a href="/an/scrutins/{vote.scrutinId}" class="divisive-vote-item">
							<div class="vote-header">
								<div class="vote-title">{vote.scrutinTitle}</div>
								<div class="vote-meta">
									<span class="vote-date"
										>{new Date(vote.scrutinDate).toLocaleDateString('fr-FR')}</span
									>
									{#if vote.category}
										<span class="vote-category">{vote.category}</span>
									{/if}
								</div>
							</div>
							<div class="vote-stats">
								<div class="vote-minority">
									<span class="minority-label">Minorité :</span>
									<span class="minority-value">{vote.minorityRate.toFixed(0)}%</span>
								</div>
								<div class="vote-distribution">
									<span class="dist-pour">Pour : {vote.distribution.pour}</span>
									<span class="dist-contre">Contre : {vote.distribution.contre}</span>
									<span class="dist-abst">Abst : {vote.distribution.abstention}</span>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<p class="empty-state">Aucun vote divisif identifié pour cette période</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<section class="card" style="margin-top: 1.5rem;">
	<h2>Informations</h2>
	<dl style="margin-top: 1rem;">
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Sigle</dt>
			<dd>{data.group.shortName || '-'}</dd>
		</div>
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Législature</dt>
			<dd>{data.group.legislature || '-'}</dd>
		</div>
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Chambre</dt>
			<dd>{data.group.chamber === 'AN' ? 'Assemblée nationale' : data.group.chamber || '-'}</dd>
		</div>
	</dl>
</section>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.group-color {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	dl {
		margin: 0;
	}

	dt,
	dd {
		margin: 0;
	}

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
		background: linear-gradient(
			90deg,
			var(--color-border) 25%,
			var(--color-bg) 50%,
			var(--color-border) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}

	.skeleton-label {
		width: 60px;
		height: 16px;
		background: linear-gradient(
			90deg,
			var(--color-border) 25%,
			var(--color-bg) 50%,
			var(--color-border) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Members list */
	.members-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 1rem;
	}

	.loading-state {
		color: var(--color-text-muted);
		padding: 2rem;
		text-align: center;
	}

	/* Divisive Votes */
	.divisive-votes-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.divisive-vote-item {
		display: block;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		text-decoration: none;
		color: var(--color-text);
		transition: all 0.2s;
	}

	.divisive-vote-item:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-primary);
	}

	.vote-header {
		margin-bottom: 0.5rem;
	}

	.vote-title {
		font-weight: 500;
		margin-bottom: 0.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.vote-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.vote-date {
		font-family: var(--font-mono);
	}

	.vote-category {
		padding: 0.125rem 0.5rem;
		background: var(--color-primary-bg);
		color: var(--color-primary);
		border-radius: var(--radius-sm);
	}

	.vote-stats {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-border);
	}

	.vote-minority {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.minority-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.minority-value {
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--color-warning);
		font-size: 0.875rem;
	}

	.vote-distribution {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
	}

	.dist-pour {
		color: var(--color-success);
	}

	.dist-contre {
		color: var(--color-danger);
	}

	.dist-abst {
		color: var(--color-text-muted);
	}
</style>
