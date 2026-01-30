<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ProfileHeader from '$lib/components/ProfileHeader.svelte';

	let { data } = $props();

	// Separate mandates by type
	const groupMandates = $derived(data.mandates.filter((m) => m.organType === 'GP'));
	const committeeMandates = $derived(data.mandates.filter((m) => m.organType === 'COM'));
	const delegationMandates = $derived(data.mandates.filter((m) => m.organType === 'DEL'));
</script>

<svelte:head>
	<title>{data.actor.fullName} - Eurodéputé - NosElus</title>
</svelte:head>

{#await data.voteStats then voteStats}
	<ProfileHeader
		name={data.actor.fullName}
		civility={data.actor.civility}
		photoUrl={data.actor.photoUrl}
		type="eurodepute"
		group={data.group
			? {
					id: data.group.groupId,
					name: data.group.groupName,
					shortName: data.group.groupShortName,
					color: data.group.groupColor
				}
			: null}
		profession={data.actor.profession}
		birthDate={data.actor.birthDate}
		birthPlace={data.actor.birthPlace}
		timeline={voteStats.voteCount > 0 ? voteStats.timeline : null}
	/>
{/await}

<div class="card-grid">
	<AsyncCard title="Statistiques de vote" promise={data.voteStats} minHeight="180px">
		{#snippet children(voteStats)}
			{#if voteStats.voteCount === 0}
				<p class="empty-state">Aucun vote enregistré</p>
				<p class="coming-soon">
					Les votes seront disponibles après import via <code>make etl-europarl-votes</code>
				</p>
			{:else}
				<p style="color: var(--color-text-muted); margin: 0.5rem 0 1rem;">
					{voteStats.voteCount} votes enregistrés
				</p>

				{@const totalVotes =
					voteStats.distribution.pour +
					voteStats.distribution.contre +
					voteStats.distribution.abstention +
					voteStats.distribution['non-votant']}
				{#if totalVotes > 0}
					<div class="vote-bar" style="height: 24px; border-radius: 12px;">
						<div
							class="vote-bar-for"
							style="width: {(voteStats.distribution.pour / totalVotes) * 100}%"
						></div>
						<div
							class="vote-bar-against"
							style="width: {(voteStats.distribution.contre / totalVotes) * 100}%"
						></div>
						<div
							class="vote-bar-abstention"
							style="width: {(voteStats.distribution.abstention / totalVotes) * 100}%"
						></div>
						{#if voteStats.distribution['non-votant'] > 0}
							<div
								class="vote-bar-nonvotant"
								style="width: {(voteStats.distribution['non-votant'] / totalVotes) * 100}%"
							></div>
						{/if}
					</div>
					<div
						style="display: flex; justify-content: space-around; margin-top: 1rem; text-align: center;"
					>
						<div>
							<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">
								{voteStats.distribution.pour}
							</div>
							<div style="font-size: 0.875rem; color: var(--color-text-muted);">Pour</div>
						</div>
						<div>
							<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-danger);">
								{voteStats.distribution.contre}
							</div>
							<div style="font-size: 0.875rem; color: var(--color-text-muted);">Contre</div>
						</div>
						<div>
							<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">
								{voteStats.distribution.abstention}
							</div>
							<div style="font-size: 0.875rem; color: var(--color-text-muted);">Abstention</div>
						</div>
						{#if voteStats.distribution['non-votant'] > 0}
							<div>
								<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-text-muted);">
									{voteStats.distribution['non-votant']}
								</div>
								<div style="font-size: 0.875rem; color: var(--color-text-muted);">Non-votants</div>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		{/snippet}
	</AsyncCard>

	<AsyncCard title="Derniers votes" promise={data.recentVotes} minHeight="300px">
		{#snippet children(recentVotes)}
			{#if recentVotes.length === 0}
				<p class="empty-state">Aucun vote enregistré</p>
			{:else}
				<div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
					{#each recentVotes as vote}
						<div class="vote-item">
							<span
								class="vote-position"
								class:pour={vote.position === 'pour'}
								class:contre={vote.position === 'contre'}
								class:abstention={vote.position === 'abstention'}
							>
								{vote.position}
							</span>
							<div class="vote-info">
								<div class="vote-title">
									{vote.scrutinTitle?.slice(0, 80)}{(vote.scrutinTitle?.length || 0) > 80
										? '...'
										: ''}
								</div>
								<div class="vote-date">
									{new Date(vote.scrutinDate).toLocaleDateString('fr-FR')}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard
		title="Évolution des votes"
		subtitle="Répartition des votes par mois"
		promise={data.monthlyEvolution}
		minHeight="220px"
	>
		{#snippet children(monthlyEvolution)}
			{#if monthlyEvolution.length > 0}
				<div class="evolution-chart">
					{#each monthlyEvolution.slice(-12) as month}
						{@const maxTotal = Math.max(...monthlyEvolution.map((m) => m.total))}
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
							<span class="evolution-value">{month.total}</span>
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

<div class="content-section">
	{#if groupMandates.length > 0}
		<div class="card">
			<h2>Groupe politique</h2>
			<div class="mandates-list">
				{#each groupMandates as mandate}
					<div class="mandate-item">
						<div class="mandate-info">
							<span class="mandate-name">{mandate.organName}</span>
							{#if mandate.organShortName}
								<span class="mandate-short">({mandate.organShortName})</span>
							{/if}
						</div>
						{#if mandate.quality}
							<div class="mandate-quality">{mandate.quality}</div>
						{/if}
						<div class="mandate-dates">
							{#if mandate.startDate}
								Depuis {new Date(mandate.startDate).toLocaleDateString('fr-FR')}
							{/if}
							{#if mandate.endDate}
								- {new Date(mandate.endDate).toLocaleDateString('fr-FR')}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if committeeMandates.length > 0}
		<div class="card">
			<h2>Commissions</h2>
			<div class="mandates-list">
				{#each committeeMandates as mandate}
					<div class="mandate-item">
						<div class="mandate-info">
							<span class="mandate-name">{mandate.organName}</span>
							{#if mandate.organShortName}
								<span class="mandate-short">({mandate.organShortName})</span>
							{/if}
						</div>
						{#if mandate.quality}
							<div class="mandate-quality">{mandate.quality}</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if delegationMandates.length > 0}
		<div class="card">
			<h2>Délégations</h2>
			<div class="mandates-list">
				{#each delegationMandates as mandate}
					<div class="mandate-item">
						<div class="mandate-info">
							<span class="mandate-name">{mandate.organName}</span>
							{#if mandate.organShortName}
								<span class="mandate-short">({mandate.organShortName})</span>
							{/if}
						</div>
						{#if mandate.quality}
							<div class="mandate-quality">{mandate.quality}</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.content-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow-sm);
	}

	h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: var(--color-text);
	}

	.mandates-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.mandate-item {
		padding: 0.75rem;
		background: var(--color-bg);
		border-radius: var(--radius);
	}

	.mandate-info {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: baseline;
	}

	.mandate-name {
		font-weight: 500;
	}

	.mandate-short {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.mandate-quality {
		font-size: 0.875rem;
		color: var(--color-primary);
		margin-top: 0.25rem;
	}

	.mandate-dates {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.coming-soon {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.coming-soon code {
		background: var(--color-bg);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.8125rem;
	}

	/* Vote items */
	.vote-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: var(--radius);
	}

	.vote-info {
		flex: 1;
		min-width: 0;
	}

	.vote-title {
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.vote-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.vote-position {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		white-space: nowrap;
		background: var(--color-bg);
		color: var(--color-text-muted);
	}

	.vote-position.pour {
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success);
	}

	.vote-position.contre {
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger);
	}

	.vote-position.abstention {
		background: var(--color-warning-bg, #fef3c7);
		color: var(--color-warning);
	}

	/* Vote bar */
	.vote-bar {
		display: flex;
		background: var(--color-bg);
		overflow: hidden;
	}

	.vote-bar-for {
		background: var(--color-success);
	}

	.vote-bar-against {
		background: var(--color-danger);
	}

	.vote-bar-abstention {
		background: var(--color-warning);
	}

	/* Evolution chart */
	.evolution-chart {
		display: flex;
		gap: 4px;
		align-items: flex-end;
		height: 150px;
		padding: 0.5rem 0;
	}

	.evolution-bar-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		height: 100%;
	}

	.evolution-bar {
		width: 100%;
		max-width: 24px;
		background: var(--color-bg);
		border-radius: 4px 4px 0 0;
		overflow: hidden;
		display: flex;
		flex-direction: column-reverse;
	}

	.bar-segment {
		width: 100%;
	}

	.bar-segment.pour {
		background: var(--color-success);
	}

	.bar-segment.contre {
		background: var(--color-danger);
	}

	.bar-segment.abstention {
		background: var(--color-warning);
	}

	.evolution-label {
		font-size: 0.625rem;
		color: var(--color-text-muted);
	}

	.evolution-value {
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.evolution-legend {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 0.5rem;
		font-size: 0.75rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--color-text-muted);
	}

	.legend-box {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.legend-box.pour {
		background: var(--color-success);
	}

	.legend-box.contre {
		background: var(--color-danger);
	}

	.legend-box.abstention {
		background: var(--color-warning);
	}
</style>
