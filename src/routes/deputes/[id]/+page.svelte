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

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
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

	.vote-position {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		background: var(--color-bg);
		white-space: nowrap;
	}

	.vote-position.pour {
		background: #dcfce7;
		color: #166534;
	}

	.vote-position.contre {
		background: #fee2e2;
		color: #991b1b;
	}

	.vote-position.abstention {
		background: #fef3c7;
		color: #92400e;
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
</style>
