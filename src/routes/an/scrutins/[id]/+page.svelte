<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import VoteDistributionCard from '$lib/components/VoteDistributionCard.svelte';
	import GroupName from '$lib/components/GroupName.svelte';

	let { data } = $props();

	const categoryLabels: Record<string, string> = {
		'vote-final': 'Vote final',
		amendement: 'Amendement',
		article: 'Article',
		procedure: 'Procédure',
		budget: 'Budget',
		constitutionnel: 'Constitutionnel',
		autre: 'Autre'
	};

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	const typeLabels: Record<string, string> = {
		PJL: 'Projet de loi',
		PPL: 'Proposition de loi',
		PJLF: 'Projet de loi de finances',
		PJLFSS: 'Projet de loi de financement de la sécurité sociale'
	};
</script>

<svelte:head>
	<title>Scrutin n°{data.scrutin.number} - NosElus</title>
</svelte:head>

<div class="page-header">
	<div class="scrutin-badges">
		<span class="scrutin-number">Scrutin n°{data.scrutin.number}</span>
		{#if data.scrutin.category}
			<span class="category-badge">{categoryLabels[data.scrutin.category] || data.scrutin.category}</span>
		{/if}
		{#if data.scrutin.result}
			<span
				class="result-badge"
				class:adopted={data.scrutin.result === 'adopté'}
				class:rejected={data.scrutin.result === 'rejeté'}
			>
				{data.scrutin.result}
			</span>
		{/if}
		{#if data.isTightVote && data.tightLabel}
			<span
				class="tight-vote-badge"
				class:tie={data.scrutin.margin === 0}
				title="Marge de {data.scrutin.margin} voix"
			>
				{data.tightLabel}
			</span>
		{/if}
	</div>
	<h1 class="page-title">{data.scrutin.title}</h1>
	<p class="page-subtitle">{formatDate(data.scrutin.date)}</p>
</div>

<!-- Related Law -->
{#await data.relatedLaw then law}
	{#if law}
		<section class="card law-link-card">
			<h2>Dossier législatif</h2>
			<a href="/an/laws/{law.id}" class="law-link">
				<div class="law-type">{typeLabels[law.type] || law.type}</div>
				<div class="law-title">{law.shortTitle || law.title}</div>
				{#if law.status}
					<span
						class="law-status"
						class:status-adopted={law.status === 'adopté' || law.status === 'promulgué'}
						class:status-rejected={law.status === 'rejeté'}
					>
						{law.status}
					</span>
				{/if}
			</a>
		</section>
	{/if}
{/await}

<!-- Results summary -->
<div class="stats-grid" style="margin-top: 1.5rem;">
	<div class="stat-card">
		<div class="stat-value">{data.scrutin.totalVoters}</div>
		<div class="stat-label">Votants</div>
	</div>
	<div class="stat-card">
		<div class="stat-value" style="color: var(--color-success);">{data.scrutin.totalFor}</div>
		<div class="stat-label">Pour</div>
	</div>
	<div class="stat-card">
		<div class="stat-value" style="color: var(--color-danger);">{data.scrutin.totalAgainst}</div>
		<div class="stat-label">Contre</div>
	</div>
	<div class="stat-card">
		<div class="stat-value" style="color: var(--color-text-muted);">
			{data.scrutin.totalAbstention}
		</div>
		<div class="stat-label">Abstentions</div>
	</div>
</div>

<!-- Vote distribution chart -->
<div style="margin-top: 1.5rem;">
	<VoteDistributionCard
		distribution={{
			pour: data.scrutin.totalFor,
			contre: data.scrutin.totalAgainst,
			abstention: data.scrutin.totalAbstention,
			'non-votant': data.scrutin.totalNonVoting
		}}
	/>
</div>

<!-- Group breakdown -->
<div style="margin-top: 1.5rem;">
	<AsyncCard title="Vote par groupe" promise={data.groupBreakdown} minHeight="200px">
		{#snippet children(groups)}
			{#if groups.length === 0}
				<p class="empty-state">Aucune donnée de vote par groupe</p>
			{:else}
				<div class="groups-grid">
					{#each groups as group}
						<a href="/an/groupes/{group.id}" class="group-card">
							<div class="group-header">
								<div class="group-color" style="background: {group.color || '#ccc'}"></div>
								<div class="group-name">
									<GroupName shortName={group.shortName} fullName={group.name} />
								</div>
								<div class="group-total">{group.total}</div>
							</div>
							<div class="group-votes">
								<div class="vote-bar">
									{#if group.total > 0}
										<div
											class="bar-segment pour"
											style="width: {(group.pour / group.total) * 100}%"
										></div>
										<div
											class="bar-segment contre"
											style="width: {(group.contre / group.total) * 100}%"
										></div>
										<div
											class="bar-segment abstention"
											style="width: {(group.abstention / group.total) * 100}%"
										></div>
									{/if}
								</div>
								<div class="vote-counts">
									<span class="vote-pour">{group.pour}</span>
									<span class="vote-contre">{group.contre}</span>
									<span class="vote-abstention">{group.abstention}</span>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<!-- Individual voters -->
<div style="margin-top: 1.5rem;">
	<AsyncCard title="Votes individuels" promise={data.voters} minHeight="200px">
		{#snippet children(voters)}
			{#if voters.length === 0}
				<p class="empty-state">Aucun vote individuel</p>
			{:else}
				<div class="voters-grid">
					{#each voters as voter}
						<a href="/an/deputes/{voter.actorId}" class="voter-card" data-position={voter.position?.toLowerCase()}>
							{#if voter.actorPhoto}
								<img src={voter.actorPhoto} alt="" class="voter-photo" />
							{:else}
								<div class="voter-photo placeholder"></div>
							{/if}
							<div class="voter-info">
								<div class="voter-name">{voter.actorName}</div>
								{#if voter.groupName}
									<div class="voter-group" style="color: {voter.groupColor || 'inherit'}">
										{voter.groupName}
									</div>
								{/if}
							</div>
							<div class="voter-position">{voter.position}</div>
						</a>
					{/each}
				</div>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<!-- Info -->
<section class="card" style="margin-top: 1.5rem;">
	<h2>Informations</h2>
	<dl class="info-list">
		<div class="info-row">
			<dt>Numéro</dt>
			<dd>{data.scrutin.number}</dd>
		</div>
		<div class="info-row">
			<dt>Législature</dt>
			<dd>{data.scrutin.legislature}</dd>
		</div>
		<div class="info-row">
			<dt>Type</dt>
			<dd>{data.scrutin.type}</dd>
		</div>
		{#if data.scrutin.sortType}
			<div class="info-row">
				<dt>Sort</dt>
				<dd>{data.scrutin.sortType}</dd>
			</div>
		{/if}
		{#if data.scrutin.sessionOrdinary}
			<div class="info-row">
				<dt>Session</dt>
				<dd>{data.scrutin.sessionOrdinary}</dd>
			</div>
		{/if}
		{#if data.scrutin.description}
			<div class="info-row full-width">
				<dt>Description</dt>
				<dd>{data.scrutin.description}</dd>
			</div>
		{/if}
	</dl>
</section>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.scrutin-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.scrutin-number {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.category-badge {
		padding: 0.125rem 0.5rem;
		background: var(--color-primary-bg);
		color: var(--color-primary);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}

	.result-badge {
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.result-badge.adopted {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.result-badge.rejected {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.tight-vote-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		background-color: var(--color-warning-bg);
		color: var(--color-warning);
		border: 1px solid var(--color-warning-border);
	}

	.tight-vote-badge.tie {
		background-color: var(--color-info-bg);
		color: var(--color-info);
		border-color: var(--color-info-border);
	}

	/* Law link card */
	.law-link-card {
		margin-top: 1.5rem;
	}

	.law-link {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		transition: all 0.2s;
	}

	.law-link:hover {
		background: var(--color-bg-hover);
	}

	.law-type {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.law-title {
		flex: 1;
		font-weight: 500;
	}

	.law-status {
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}

	.law-status.status-adopted {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.law-status.status-rejected {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	/* Groups grid */
	.groups-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.group-card {
		display: block;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		transition: all 0.2s;
	}

	.group-card:hover {
		background: var(--color-bg-hover);
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.group-color {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.group-name {
		flex: 1;
		font-weight: 500;
	}

	.group-total {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.group-votes {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.vote-bar {
		display: flex;
		height: 8px;
		background: var(--color-border);
		border-radius: 4px;
		overflow: hidden;
	}

	.bar-segment {
		height: 100%;
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

	.vote-counts {
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
	}

	.vote-pour {
		color: var(--color-success);
	}

	.vote-contre {
		color: var(--color-danger);
	}

	.vote-abstention {
		color: var(--color-text-muted);
	}

	/* Voters grid */
	.voters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 0.5rem;
	}

	.voter-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		border-left: 3px solid transparent;
		transition: all 0.2s;
	}

	.voter-card:hover {
		background: var(--color-bg-hover);
	}

	.voter-card[data-position='pour'] {
		border-left-color: var(--color-success);
	}

	.voter-card[data-position='contre'] {
		border-left-color: var(--color-danger);
	}

	.voter-card[data-position='abstention'] {
		border-left-color: var(--color-warning);
	}

	.voter-photo {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.voter-photo.placeholder {
		background: var(--color-border);
	}

	.voter-info {
		flex: 1;
		min-width: 0;
	}

	.voter-name {
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.voter-group {
		font-size: 0.75rem;
	}

	.voter-position {
		font-size: 0.75rem;
		text-transform: capitalize;
		color: var(--color-text-muted);
	}

	/* Info list */
	.info-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin: 0;
	}

	.info-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-row.full-width {
		grid-column: 1 / -1;
	}

	.info-row dt {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.info-row dd {
		margin: 0;
		font-size: 0.875rem;
	}
</style>
