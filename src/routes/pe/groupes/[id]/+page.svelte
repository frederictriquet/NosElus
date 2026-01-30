<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ElectedCard from '$lib/components/ElectedCard.svelte';
	import VoteDistributionCard from '$lib/components/VoteDistributionCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.group.name} - Parlement européen - NosElus</title>
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

{#await data.members}
	<section class="card">
		<h2>Eurodéputés français du groupe</h2>
		<div class="loading-state">Chargement...</div>
	</section>
{:then members}
	<section class="card">
		<h2>Eurodéputés français du groupe ({members.length})</h2>
		{#if members.length === 0}
			<p class="empty-state">Aucun eurodéputé français trouvé</p>
		{:else}
			<div class="members-grid">
				{#each members as member}
					<ElectedCard
						id={member.id}
						name={member.name}
						photoUrl={member.photoUrl}
						variant="compact"
						type="eurodepute"
					/>
				{/each}
			</div>
		{/if}
	</section>
{:catch}
	<section class="card">
		<h2>Eurodéputés français du groupe</h2>
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
			<dt style="color: var(--color-text-muted); width: 120px;">Chambre</dt>
			<dd>Parlement européen</dd>
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

	/* Members grid */
	.members-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.loading-state {
		color: var(--color-text-muted);
		padding: 2rem;
		text-align: center;
	}
</style>
