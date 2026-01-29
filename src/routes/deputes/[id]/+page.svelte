<script lang="ts">
	let { data } = $props();

	const totalVotes = data.distribution.pour + data.distribution.contre + data.distribution.abstention + data.distribution['non-votant'];
</script>

<svelte:head>
	<title>{data.actor.fullName} - NosElus</title>
</svelte:head>

<div class="profile-header">
	<img
		src={data.actor.photoUrl || '/placeholder.png'}
		alt={data.actor.fullName}
		class="profile-photo"
	/>
	<div class="profile-info">
		<h1>{data.actor.civility} {data.actor.fullName}</h1>
		{#if data.group}
			<a href="/groupes/{data.group.groupId}" class="group-badge" style="background: {data.group.groupColor || '#888'}20; border: 1px solid {data.group.groupColor || '#888'}; color: {data.group.groupColor || '#888'};">
				<span class="group-dot" style="background: {data.group.groupColor || '#888'}"></span>
				{data.group.groupShortName || data.group.groupName}
			</a>
		{/if}
		<div class="profile-meta">
			{#if data.actor.profession}
				<span>{data.actor.profession}</span>
			{/if}
			{#if data.actor.birthDate}
				<span>Né(e) le {new Date(data.actor.birthDate).toLocaleDateString('fr-FR')}</span>
			{/if}
			{#if data.actor.birthPlace}
				<span>à {data.actor.birthPlace}</span>
			{/if}
		</div>
		{#if data.timeline.firstVote && data.timeline.lastVote}
			<div class="activity-period">
				<span class="activity-label">Activité parlementaire :</span>
				<span class="activity-dates">
					{new Date(data.timeline.firstVote).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
					→
					{new Date(data.timeline.lastVote).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
				</span>
			</div>
		{/if}
	</div>
</div>

<div class="card-grid">
	<section class="card">
		<h2>Statistiques de vote</h2>
		<p style="color: var(--color-text-muted); margin: 0.5rem 0 1rem;">{data.voteCount} votes enregistrés</p>

		{#if totalVotes > 0}
			<div class="vote-bar" style="height: 24px; border-radius: 12px;">
				<div class="vote-bar-for" style="width: {(data.distribution.pour / totalVotes) * 100}%"></div>
				<div class="vote-bar-against" style="width: {(data.distribution.contre / totalVotes) * 100}%"></div>
				<div class="vote-bar-abstention" style="width: {(data.distribution.abstention / totalVotes) * 100}%"></div>
			</div>
			<div style="display: flex; justify-content: space-around; margin-top: 1rem; text-align: center;">
				<div>
					<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">{data.distribution.pour}</div>
					<div style="font-size: 0.875rem; color: var(--color-text-muted);">Pour</div>
				</div>
				<div>
					<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-danger);">{data.distribution.contre}</div>
					<div style="font-size: 0.875rem; color: var(--color-text-muted);">Contre</div>
				</div>
				<div>
					<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">{data.distribution.abstention}</div>
					<div style="font-size: 0.875rem; color: var(--color-text-muted);">Abstention</div>
				</div>
			</div>
		{:else}
			<p class="empty-state">Aucun vote enregistré</p>
		{/if}
	</section>

	<section class="card">
		<h2>Derniers votes</h2>
		{#if data.recentVotes.length === 0}
			<p class="empty-state">Aucun vote enregistré</p>
		{:else}
			<div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
				{#each data.recentVotes as vote}
					<a href="/scrutins/{vote.scrutinId}" class="vote-item">
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
	</section>
</div>

{#if data.monthlyEvolution.length > 0}
<section class="card" style="margin-top: 1.5rem;">
	<h2>Évolution des votes</h2>
	<p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
		Répartition des votes par mois
	</p>
	<div class="evolution-chart">
		{#each data.monthlyEvolution.slice(-12) as month}
			{@const maxTotal = Math.max(...data.monthlyEvolution.map(m => m.total))}
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
</section>
{/if}

{#if data.careerMilestones.length > 0}
<section class="card" style="margin-top: 1.5rem;">
	<h2>Parcours parlementaire</h2>
	<div class="career-timeline">
		{#each data.careerMilestones as milestone, i}
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
</section>
{/if}

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

	.group-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border-radius: 20px;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		margin: 0.5rem 0;
	}

	.group-badge:hover {
		text-decoration: none;
		opacity: 0.9;
	}

	.group-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.activity-period {
		margin-top: 0.5rem;
		font-size: 0.875rem;
	}

	.activity-label {
		color: var(--color-text-muted);
	}

	.activity-dates {
		font-weight: 500;
		color: var(--color-text);
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
</style>
