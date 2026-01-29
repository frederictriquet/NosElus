<script lang="ts">
	import ProfileHeader from '$lib/components/ProfileHeader.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.actor.fullName} - Sénateur - NosElus</title>
</svelte:head>

<ProfileHeader
	name={data.actor.fullName}
	civility={data.actor.civility}
	photoUrl={data.actor.photoUrl}
	type="senateur"
	group={data.group ? {
		id: data.group.groupId,
		name: data.group.groupName,
		shortName: data.group.groupShortName,
		color: data.group.groupColor
	} : null}
	profession={data.actor.profession}
	constituency={data.group?.constituency}
/>

<div class="info-cards">
	<section class="card">
		<h2>Informations</h2>
		<dl class="info-list">
			<div class="info-item">
				<dt>Chambre</dt>
				<dd>Sénat</dd>
			</div>
			{#if data.group?.constituency}
				<div class="info-item">
					<dt>Circonscription</dt>
					<dd>{data.group.constituency}</dd>
				</div>
			{/if}
			{#if data.actor.profession}
				<div class="info-item">
					<dt>Profession</dt>
					<dd>{data.actor.profession}</dd>
				</div>
			{/if}
			{#if data.group}
				<div class="info-item">
					<dt>Groupe politique</dt>
					<dd>
						<span class="group-inline">
							<span class="group-dot" style="background: {data.group.groupColor || '#888'}"></span>
							{data.group.groupName || data.group.groupShortName}
						</span>
					</dd>
				</div>
			{/if}
		</dl>
	</section>

	<section class="card">
		<h2>Liens externes</h2>
		<div class="external-links">
			<a
				href="https://www.senat.fr/senateur/{data.actor.uid?.toLowerCase() ?? ''}.html"
				target="_blank"
				rel="noopener noreferrer"
				class="external-link"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
				Fiche sur senat.fr
			</a>
		</div>
	</section>
</div>

<div class="notice">
	<p>
		<strong>Note :</strong> Les données de votes et d'amendements ne sont pas encore disponibles pour les sénateurs.
		Les scrutins publics du Sénat seront ajoutés dans une prochaine version.
	</p>
</div>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.info-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.info-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.info-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.info-item:last-child {
		border-bottom: none;
	}

	.info-item dt {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.info-item dd {
		font-weight: 500;
		margin: 0;
	}

	.group-inline {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.group-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.external-links {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.external-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--color-text);
		transition: background 0.2s;
	}

	.external-link:hover {
		background: var(--color-border);
		text-decoration: none;
	}

	.external-link svg {
		color: var(--color-primary);
	}

	.notice {
		margin-top: 2rem;
		padding: 1rem 1.25rem;
		background: var(--color-bg);
		border-radius: var(--radius);
		border-left: 4px solid var(--color-primary);
	}

	.notice p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.notice strong {
		color: var(--color-text);
	}
</style>
