<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ElectedCard from '$lib/components/ElectedCard.svelte';

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
		{#each Array(4) as _}
			<div class="stat-card loading">
				<div class="skeleton-value"></div>
				<div class="skeleton-label"></div>
			</div>
		{/each}
	</div>
{:then distributionData}
	{@const totalVotes = distributionData.distribution.pour + distributionData.distribution.contre + distributionData.distribution.abstention}
	<div class="stats-grid" style="margin-bottom: 1.5rem;">
		<div class="stat-card">
			<div class="stat-value">{distributionData.totalVotes.toLocaleString('fr-FR')}</div>
			<div class="stat-label">Votes enregistrés</div>
		</div>
		{#await data.members then members}
			<div class="stat-card">
				<div class="stat-value">{members.length}</div>
				<div class="stat-label">Députés actifs</div>
			</div>
		{/await}
		<div class="stat-card">
			<div class="stat-value" style="color: var(--color-success);">
				{totalVotes > 0 ? ((distributionData.distribution.pour / totalVotes) * 100).toFixed(0) : 0}%
			</div>
			<div class="stat-label">Votes pour</div>
		</div>
		<div class="stat-card">
			<div class="stat-value" style="color: var(--color-danger);">
				{totalVotes > 0 ? ((distributionData.distribution.contre / totalVotes) * 100).toFixed(0) : 0}%
			</div>
			<div class="stat-label">Votes contre</div>
		</div>
	</div>
{/await}

<div class="card-grid">
	<AsyncCard title="Répartition des votes" promise={data.distributionData} minHeight="150px">
		{#snippet children(distributionData)}
			{@const totalVotes = distributionData.distribution.pour + distributionData.distribution.contre + distributionData.distribution.abstention}
			{#if totalVotes > 0}
				<div class="vote-bar" style="height: 24px; border-radius: 12px; margin-top: 1rem;">
					<div class="vote-bar-for" style="width: {(distributionData.distribution.pour / totalVotes) * 100}%"></div>
					<div class="vote-bar-against" style="width: {(distributionData.distribution.contre / totalVotes) * 100}%"></div>
					<div class="vote-bar-abstention" style="width: {(distributionData.distribution.abstention / totalVotes) * 100}%"></div>
				</div>
				<div style="display: flex; justify-content: space-around; margin-top: 1rem; text-align: center;">
					<div>
						<div style="font-size: 1.25rem; font-weight: 700; color: var(--color-success);">{distributionData.distribution.pour.toLocaleString('fr-FR')}</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Pour</div>
					</div>
					<div>
						<div style="font-size: 1.25rem; font-weight: 700; color: var(--color-danger);">{distributionData.distribution.contre.toLocaleString('fr-FR')}</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Contre</div>
					</div>
					<div>
						<div style="font-size: 1.25rem; font-weight: 700; color: var(--color-warning);">{distributionData.distribution.abstention.toLocaleString('fr-FR')}</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Abstention</div>
					</div>
				</div>
			{:else}
				<p class="empty-state">Aucun vote enregistré</p>
			{/if}
		{/snippet}
	</AsyncCard>

	<AsyncCard title="Députés les plus actifs" promise={data.members} minHeight="300px">
		{#snippet children(members)}
			{#if members.length === 0}
				<p class="empty-state">Aucun membre trouvé</p>
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
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Évolution des votes" promise={data.monthlyActivity} minHeight="200px">
		{#snippet children(monthlyActivity)}
			{#if monthlyActivity.length > 0}
				<div class="evolution-chart">
					{#each monthlyActivity.slice(-12) as month}
						{@const maxTotal = Math.max(...monthlyActivity.map(m => m.total))}
						{@const height = (month.total / maxTotal) * 100}
						{@const pourPct = month.total > 0 ? (month.pour / month.total) * 100 : 0}
						{@const contrePct = month.total > 0 ? (month.contre / month.total) * 100 : 0}
						{@const abstPct = month.total > 0 ? (month.abstention / month.total) * 100 : 0}
						<div class="evolution-bar-container" title="{month.month}: {month.total} votes">
							<div class="evolution-bar" style="height: {height}%;">
								<div class="bar-segment pour" style="height: {pourPct}%"></div>
								<div class="bar-segment contre" style="height: {contrePct}%"></div>
								<div class="bar-segment abstention" style="height: {abstPct}%"></div>
							</div>
							<span class="evolution-label">{month.month.slice(5)}</span>
						</div>
					{/each}
				</div>
				<div class="evolution-legend">
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

	dt, dd {
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
</style>
