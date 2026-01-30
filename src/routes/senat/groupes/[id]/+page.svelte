<script lang="ts">
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.group.name} - Sénat - NosElus</title>
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
		<h2>Membres du groupe</h2>
		<div class="loading-state">Chargement...</div>
	</section>
{:then members}
	<section class="card">
		<h2>Membres du groupe ({members.length})</h2>
		{#if members.length === 0}
			<p class="empty-state">Aucun sénateur trouvé dans ce groupe</p>
		{:else}
			<div class="members-grid">
				{#each members as member}
					<ElectedCard
						id={member.id}
						name={member.name}
						photoUrl={member.photoUrl}
						variant="compact"
						type="senateur"
					/>
				{/each}
			</div>
		{/if}
	</section>
{:catch}
	<section class="card">
		<h2>Membres du groupe</h2>
		<p class="empty-state">Erreur de chargement</p>
	</section>
{/await}

<section class="card" style="margin-top: 1.5rem;">
	<h2>Informations</h2>
	<dl style="margin-top: 1rem;">
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Sigle</dt>
			<dd>{data.group.shortName || '-'}</dd>
		</div>
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Chambre</dt>
			<dd>Sénat</dd>
		</div>
	</dl>
</section>

<div class="info-box" style="margin-top: 1.5rem;">
	<strong>Statistiques non disponibles</strong>
	<p>Les statistiques de vote ne sont pas disponibles pour le Sénat. Le Sénat ne publie pas les votes individuels nominatifs de manière exploitable.</p>
</div>

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

	.members-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.info-box {
		background: #fef3c7;
		border: 1px solid #f59e0b;
		border-radius: var(--radius);
		padding: 1rem;
		font-size: 0.875rem;
		color: #92400e;
	}

	.info-box strong {
		display: block;
		margin-bottom: 0.5rem;
	}

	.info-box p {
		margin: 0;
	}

	.loading-state {
		color: var(--color-text-muted);
		padding: 2rem;
		text-align: center;
	}
</style>
