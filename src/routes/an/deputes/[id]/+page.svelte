<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ProfileHeader from '$lib/components/ProfileHeader.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.actor.fullName} - NosElus</title>
</svelte:head>

{#await data.voteStats then voteStats}
	<ProfileHeader
		name={data.actor.fullName}
		civility={data.actor.civility}
		photoUrl={data.actor.photoUrl}
		type="depute"
		group={data.group ? {
			id: data.group.groupId,
			name: data.group.groupName,
			shortName: data.group.groupShortName,
			color: data.group.groupColor
		} : null}
		profession={data.actor.profession}
		birthDate={data.actor.birthDate}
		birthPlace={data.actor.birthPlace}
		timeline={voteStats.timeline}
	/>
{/await}

<div class="card-grid">
	<AsyncCard title="Statistiques de vote" promise={data.voteStats} minHeight="180px">
		{#snippet children(voteStats)}
			<p style="color: var(--color-text-muted); margin: 0.5rem 0 1rem;">{voteStats.voteCount} votes enregistrés</p>

			{@const totalVotes = voteStats.distribution.pour + voteStats.distribution.contre + voteStats.distribution.abstention + voteStats.distribution['non-votant']}
			{#if totalVotes > 0}
				<div class="vote-bar" style="height: 24px; border-radius: 12px;">
					<div class="vote-bar-for" style="width: {(voteStats.distribution.pour / totalVotes) * 100}%"></div>
					<div class="vote-bar-against" style="width: {(voteStats.distribution.contre / totalVotes) * 100}%"></div>
					<div class="vote-bar-abstention" style="width: {(voteStats.distribution.abstention / totalVotes) * 100}%"></div>
				</div>
				<div style="display: flex; justify-content: space-around; margin-top: 1rem; text-align: center;">
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">{voteStats.distribution.pour}</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Pour</div>
					</div>
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-danger);">{voteStats.distribution.contre}</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Contre</div>
					</div>
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">{voteStats.distribution.abstention}</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Abstention</div>
					</div>
				</div>
			{:else}
				<p class="empty-state">Aucun vote enregistré</p>
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
						<a href="/an/scrutins/{vote.scrutinId}" class="vote-item">
							<span class="vote-position" class:pour={vote.position === 'pour'} class:contre={vote.position === 'contre'} class:abstention={vote.position === 'abstention'}>
								{vote.position}
							</span>
							<div class="vote-info">
								<div class="vote-title">{vote.scrutinTitle?.slice(0, 80)}{(vote.scrutinTitle?.length || 0) > 80 ? '...' : ''}</div>
								<div class="vote-date">{new Date(vote.scrutinDate).toLocaleDateString('fr-FR')}</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Évolution des votes" subtitle="Répartition des votes par mois" promise={data.monthlyEvolution} minHeight="220px">
		{#snippet children(monthlyEvolution)}
			{#if monthlyEvolution.length > 0}
				<div class="evolution-chart">
					{#each monthlyEvolution.slice(-12) as month}
						{@const maxTotal = Math.max(...monthlyEvolution.map(m => m.total))}
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

<div style="margin-top: 1.5rem;">
	<AsyncCard title="Parcours parlementaire" promise={data.careerMilestones} minHeight="150px">
		{#snippet children(careerMilestones)}
			{#if careerMilestones.length > 0}
				<div class="career-timeline">
					{#each careerMilestones as milestone}
						<div class="timeline-item" class:first={milestone.type === 'first_vote'} class:last={milestone.type === 'last_vote'}>
							<div class="timeline-marker">
								{#if milestone.type === 'first_vote'}
									<span class="marker-icon">&#9654;</span>
								{:else if milestone.type === 'last_vote'}
									<span class="marker-icon">&#9632;</span>
								{:else}
									<span class="marker-icon">&#9733;</span>
								{/if}
							</div>
							<div class="timeline-content">
								<div class="timeline-date">{new Date(milestone.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
								<div class="timeline-title">{milestone.title}</div>
								{#if milestone.description}
									<div class="timeline-desc">{milestone.description}</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-state">Aucune donnée de parcours</p>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

{#await data.amendmentStats then amendmentStats}
	{#if amendmentStats.total > 0}
		<div class="card-grid" style="margin-top: 1.5rem;">
			<AsyncCard title="Amendements déposés" promise={data.amendmentStats} minHeight="180px">
				{#snippet children(amendmentStats)}
					<p style="color: var(--color-text-muted); margin: 0.5rem 0 1rem;">{amendmentStats.total} amendement{amendmentStats.total > 1 ? 's' : ''}</p>

					{@const totalAmendments = amendmentStats.adopte + amendmentStats.rejete + amendmentStats.retire + amendmentStats.tombe + amendmentStats.autre}
					{#if totalAmendments > 0}
						<div class="amendment-bar" style="height: 24px; border-radius: 12px;">
							<div class="amendment-bar-adopte" style="width: {(amendmentStats.adopte / totalAmendments) * 100}%"></div>
							<div class="amendment-bar-rejete" style="width: {(amendmentStats.rejete / totalAmendments) * 100}%"></div>
							<div class="amendment-bar-retire" style="width: {(amendmentStats.retire / totalAmendments) * 100}%"></div>
							<div class="amendment-bar-tombe" style="width: {(amendmentStats.tombe / totalAmendments) * 100}%"></div>
						</div>
						<div style="display: flex; justify-content: space-around; margin-top: 1rem; text-align: center; flex-wrap: wrap; gap: 0.5rem;">
							<div>
								<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">{amendmentStats.adopte}</div>
								<div style="font-size: 0.875rem; color: var(--color-text-muted);">Adoptés</div>
							</div>
							<div>
								<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-danger);">{amendmentStats.rejete}</div>
								<div style="font-size: 0.875rem; color: var(--color-text-muted);">Rejetés</div>
							</div>
							<div>
								<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">{amendmentStats.retire}</div>
								<div style="font-size: 0.875rem; color: var(--color-text-muted);">Retirés</div>
							</div>
							<div>
								<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-text-muted);">{amendmentStats.tombe}</div>
								<div style="font-size: 0.875rem; color: var(--color-text-muted);">Tombés</div>
							</div>
						</div>
					{/if}
				{/snippet}
			</AsyncCard>

			<AsyncCard title="Derniers amendements" promise={data.recentAmendments} minHeight="300px">
				{#snippet children(recentAmendments)}
					{#if recentAmendments.length === 0}
						<p class="empty-state">Aucun amendement enregistré</p>
					{:else}
						<div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
							{#each recentAmendments as amendment}
								<div class="amendment-item">
									<span class="amendment-status" class:adopte={amendment.status?.toLowerCase().includes('adopt')} class:rejete={amendment.status?.toLowerCase().includes('rejet')} class:retire={amendment.status?.toLowerCase().includes('retir')} class:tombe={amendment.status?.toLowerCase().includes('tomb')}>
										{amendment.status || 'En cours'}
									</span>
									<div class="amendment-info">
										<div class="amendment-number">
											Amendement n°{amendment.number}
											{#if amendment.article}
												<span class="amendment-article">sur {amendment.article}</span>
											{/if}
										</div>
										{#if amendment.exposeSommaire}
											<div class="amendment-summary">{amendment.exposeSommaire.slice(0, 100)}{amendment.exposeSommaire.length > 100 ? '...' : ''}</div>
										{/if}
										{#if amendment.depositDate}
											<div class="amendment-date">{new Date(amendment.depositDate).toLocaleDateString('fr-FR')}</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/snippet}
			</AsyncCard>
		</div>
	{/if}
{/await}

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	/* Career Timeline */
	.career-timeline {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin-top: 1rem;
		position: relative;
		padding-left: 2rem;
	}

	.career-timeline::before {
		content: '';
		position: absolute;
		left: 0.5rem;
		top: 0.5rem;
		bottom: 0.5rem;
		width: 2px;
		background: var(--color-border);
	}

	.timeline-item {
		display: flex;
		gap: 1rem;
		padding: 0.75rem 0;
		position: relative;
	}

	.timeline-marker {
		position: absolute;
		left: -1.5rem;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--color-surface);
		border: 2px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
	}

	.timeline-item.first .timeline-marker {
		border-color: var(--color-success);
		color: var(--color-success);
	}

	.timeline-item.last .timeline-marker {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.marker-icon {
		line-height: 1;
	}

	.timeline-content {
		flex: 1;
	}

	.timeline-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.timeline-title {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.timeline-desc {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.vote-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		text-decoration: none;
		color: inherit;
		padding: 0.5rem;
		border-radius: var(--radius);
		transition: background 0.2s;
	}

	.vote-item:hover {
		background: var(--color-bg);
		text-decoration: none;
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

	/* Override evolution chart height for this page */
	.evolution-chart {
		height: 180px;
	}

	/* Amendments styles */
	.amendment-bar {
		display: flex;
		background: var(--color-bg);
		overflow: hidden;
	}

	.amendment-bar-adopte {
		background: var(--color-success);
	}

	.amendment-bar-rejete {
		background: var(--color-danger);
	}

	.amendment-bar-retire {
		background: var(--color-warning);
	}

	.amendment-bar-tombe {
		background: var(--color-text-muted);
	}

	.amendment-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: var(--radius);
	}

	.amendment-status {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		white-space: nowrap;
		background: var(--color-bg);
		color: var(--color-text-muted);
	}

	.amendment-status.adopte {
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success);
	}

	.amendment-status.rejete {
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger);
	}

	.amendment-status.retire {
		background: var(--color-warning-bg, #fef3c7);
		color: var(--color-warning);
	}

	.amendment-status.tombe {
		background: var(--color-bg);
		color: var(--color-text-muted);
	}

	.amendment-info {
		flex: 1;
		min-width: 0;
	}

	.amendment-number {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.amendment-article {
		font-weight: 400;
		color: var(--color-text-muted);
	}

	.amendment-summary {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
		line-height: 1.4;
	}

	.amendment-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}
</style>
