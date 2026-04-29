<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();

	let activeTab = $state<'pour' | 'contre' | 'abstention' | 'non-votant'>('pour');

	const totalVotes = $derived(
		data.scrutin.totalFor + data.scrutin.totalAgainst + data.scrutin.totalAbstention || 1
	);
</script>

<svelte:head>
	<title>Scrutin n°{data.scrutin.number} - Parlement européen - NosElus</title>
</svelte:head>

<div class="page-header">
	<div class="scrutin-header-meta">
		<span class="scrutin-number-label">Scrutin n°{data.scrutin.number}</span>
		<span
			class="scrutin-result"
			class:adopted={data.scrutin.result === 'adopté'}
			class:rejected={data.scrutin.result === 'rejeté'}
		>
			{data.scrutin.result}
		</span>
	</div>
	<h1 class="page-title page-title--sm">{data.scrutin.title}</h1>
	<p class="page-subtitle">
		{new Date(data.scrutin.date).toLocaleDateString('fr-FR', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})}
	</p>
</div>

<div class="card" style="margin-bottom: 2rem;">
	<h2>Résultats du vote (tous les eurodéputés)</h2>
	<div class="vote-bar vote-bar--results">
		<div class="vote-bar-for" style="width: {(data.scrutin.totalFor / totalVotes) * 100}%"></div>
		<div
			class="vote-bar-against"
			style="width: {(data.scrutin.totalAgainst / totalVotes) * 100}%"
		></div>
		<div
			class="vote-bar-abstention"
			style="width: {(data.scrutin.totalAbstention / totalVotes) * 100}%"
		></div>
	</div>
	<div class="vote-totals">
		<div>
			<div class="vote-total-value vote-total-value--for">{data.scrutin.totalFor}</div>
			<div class="vote-total-label">Pour</div>
		</div>
		<div>
			<div class="vote-total-value vote-total-value--against">{data.scrutin.totalAgainst}</div>
			<div class="vote-total-label">Contre</div>
		</div>
		<div>
			<div class="vote-total-value vote-total-value--abstention">
				{data.scrutin.totalAbstention}
			</div>
			<div class="vote-total-label">Abstention</div>
		</div>
		<div>
			<div class="vote-total-value">{data.scrutin.totalVoters}</div>
			<div class="vote-total-label">Votants</div>
		</div>
	</div>
</div>

<AsyncCard title="Votes des eurodéputés français" promise={data.voteDetails} minHeight="300px">
	{#snippet children(voteDetails)}
		{#if voteDetails.totalVotes > 0}
			<p class="votes-count-info">
				{voteDetails.totalVotes} votes enregistrés (eurodéputés français)
			</p>

			<div class="tabs">
				<button
					class="tab"
					class:active={activeTab === 'pour'}
					onclick={() => (activeTab = 'pour')}
				>
					Pour ({voteDetails.votesByPosition.pour.length})
				</button>
				<button
					class="tab"
					class:active={activeTab === 'contre'}
					onclick={() => (activeTab = 'contre')}
				>
					Contre ({voteDetails.votesByPosition.contre.length})
				</button>
				<button
					class="tab"
					class:active={activeTab === 'abstention'}
					onclick={() => (activeTab = 'abstention')}
				>
					Abstention ({voteDetails.votesByPosition.abstention.length})
				</button>
				{#if voteDetails.votesByPosition['non-votant']?.length > 0}
					<button
						class="tab"
						class:active={activeTab === 'non-votant'}
						onclick={() => (activeTab = 'non-votant')}
					>
						Non-votants ({voteDetails.votesByPosition['non-votant'].length})
					</button>
				{/if}
			</div>

			<div class="voters-grid">
				{#each voteDetails.votesByPosition[activeTab] as vote}
					<ElectedCard
						id={vote.actorId}
						name={vote.actorName}
						photoUrl={vote.actorPhoto}
						variant="compact"
						type="eurodepute"
						group={vote.groupId
							? { id: vote.groupId, shortName: vote.groupShortName, color: vote.groupColor }
							: null}
					/>
				{/each}
			</div>

			{#if voteDetails.votesByPosition[activeTab].length === 0}
				<p class="empty-state">Aucun vote dans cette catégorie</p>
			{/if}
		{:else}
			<p class="empty-state">
				Les votes individuels ne sont pas encore disponibles pour ce scrutin
			</p>
		{/if}
	{/snippet}
</AsyncCard>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 700;
		margin-bottom: 1rem;
	}

	.voters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	/* En-tête du scrutin */
	.scrutin-header-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.scrutin-number-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.page-title--sm {
		font-size: 1.5rem;
	}

	/* Barre de vote résultats */
	.vote-bar--results {
		height: 32px;
		border-radius: 16px;
		margin: 1rem 0;
	}

	/* Totaux du vote */
	.vote-totals {
		display: flex;
		justify-content: space-around;
		text-align: center;
	}

	.vote-total-value {
		font-size: 2rem;
		font-weight: 700;
	}

	.vote-total-value--for {
		color: var(--color-success);
	}

	.vote-total-value--against {
		color: var(--color-danger);
	}

	.vote-total-value--abstention {
		color: var(--color-warning);
	}

	.vote-total-label {
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.votes-count-info {
		font-weight: 500;
		color: var(--color-text-muted);
		margin-bottom: 1rem;
	}
</style>
