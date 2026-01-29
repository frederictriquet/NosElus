<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.actor.fullName} - Sénateur - NosElus</title>
</svelte:head>

<div class="profile-header">
	<img
		src={data.actor.photoUrl || '/placeholder.png'}
		alt={data.actor.fullName}
		class="profile-photo"
	/>
	<div class="profile-info">
		<h1>{data.actor.civility} {data.actor.fullName}</h1>
		<div class="profile-subtitle">Sénateur</div>
		{#if data.group}
			<a href="/groupes/{data.group.groupId}" class="group-badge" style="background: {data.group.groupColor || '#888'}20; border: 1px solid {data.group.groupColor || '#888'}; color: {data.group.groupColor || '#888'};">
				<span class="group-dot" style="background: {data.group.groupColor || '#888'}"></span>
				{data.group.groupShortName || data.group.groupName}
			</a>
		{/if}
		<div class="profile-meta">
			{#if data.group?.constituency}
				<span class="meta-item">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
					{data.group.constituency}
				</span>
			{/if}
			{#if data.actor.profession}
				<span class="meta-item">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
					{data.actor.profession}
				</span>
			{/if}
		</div>
	</div>
</div>

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

	.profile-subtitle {
		font-size: 1rem;
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
		margin: 0.75rem 0;
	}

	.group-badge:hover {
		text-decoration: none;
		opacity: 0.9;
	}

	.group-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.profile-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.meta-item svg {
		opacity: 0.7;
	}

	.info-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
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
