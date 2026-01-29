<script lang="ts">
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();

	let activeTab = $state<'pour' | 'contre' | 'abstention'>('pour');

	const totalVotes = $derived(data.scrutin.totalFor + data.scrutin.totalAgainst + data.scrutin.totalAbstention || 1);
</script>

<svelte:head>
	<title>Scrutin n°{data.scrutin.number} - NosElus</title>
</svelte:head>

<div class="page-header">
	<div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
		<span style="font-size: 0.875rem; color: var(--color-text-muted);">Scrutin n°{data.scrutin.number}</span>
		<span class="scrutin-result" class:adopted={data.scrutin.result === 'adopté'} class:rejected={data.scrutin.result === 'rejeté'}>
			{data.scrutin.result}
		</span>
	</div>
	<h1 class="page-title" style="font-size: 1.5rem;">{data.scrutin.title}</h1>
	<p class="page-subtitle">
		{new Date(data.scrutin.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
	</p>
</div>

<div class="card" style="margin-bottom: 2rem;">
	<h2>Résultats du vote</h2>
	<div class="vote-bar" style="height: 32px; border-radius: 16px; margin: 1rem 0;">
		<div class="vote-bar-for" style="width: {(data.scrutin.totalFor / totalVotes) * 100}%"></div>
		<div class="vote-bar-against" style="width: {(data.scrutin.totalAgainst / totalVotes) * 100}%"></div>
		<div class="vote-bar-abstention" style="width: {(data.scrutin.totalAbstention / totalVotes) * 100}%"></div>
	</div>
	<div style="display: flex; justify-content: space-around; text-align: center;">
		<div>
			<div style="font-size: 2rem; font-weight: 700; color: var(--color-success);">{data.scrutin.totalFor}</div>
			<div style="color: var(--color-text-muted);">Pour</div>
		</div>
		<div>
			<div style="font-size: 2rem; font-weight: 700; color: var(--color-danger);">{data.scrutin.totalAgainst}</div>
			<div style="color: var(--color-text-muted);">Contre</div>
		</div>
		<div>
			<div style="font-size: 2rem; font-weight: 700; color: var(--color-warning);">{data.scrutin.totalAbstention}</div>
			<div style="color: var(--color-text-muted);">Abstention</div>
		</div>
		<div>
			<div style="font-size: 2rem; font-weight: 700;">{data.scrutin.totalVoters}</div>
			<div style="color: var(--color-text-muted);">Votants</div>
		</div>
	</div>
</div>

{#if data.totalVotes > 0}
	<div class="card">
		<h2>Détail des votes ({data.totalVotes} votes enregistrés)</h2>

		<div class="tabs">
			<button class="tab" class:active={activeTab === 'pour'} onclick={() => activeTab = 'pour'}>
				Pour ({data.votesByPosition.pour.length})
			</button>
			<button class="tab" class:active={activeTab === 'contre'} onclick={() => activeTab = 'contre'}>
				Contre ({data.votesByPosition.contre.length})
			</button>
			<button class="tab" class:active={activeTab === 'abstention'} onclick={() => activeTab = 'abstention'}>
				Abstention ({data.votesByPosition.abstention.length})
			</button>
		</div>

		<div class="voters-grid">
			{#each data.votesByPosition[activeTab] as vote}
				<ElectedCard
					id={vote.actorId}
					name={vote.actorName}
					photoUrl={vote.actorPhoto}
					variant="compact"
				/>
			{/each}
		</div>

		{#if data.votesByPosition[activeTab].length === 0}
			<p class="empty-state">Aucun vote dans cette catégorie</p>
		{/if}
	</div>
{:else}
	<div class="card">
		<p class="empty-state">Les votes individuels ne sont pas encore disponibles pour ce scrutin</p>
	</div>
{/if}

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.voters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
	}
</style>
