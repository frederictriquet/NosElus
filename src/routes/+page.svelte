<script lang="ts">
	let { data } = $props();
</script>

<div class="page-header">
	<h1 class="page-title">Suivi de l'activité parlementaire</h1>
	<p class="page-subtitle">Explorez les votes et activités des élus de l'Assemblée nationale</p>
</div>

<div class="stats-grid">
	<div class="stat-card">
		<div class="stat-value">{data.stats.deputies}</div>
		<div class="stat-label">Députés</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{data.stats.scrutins}</div>
		<div class="stat-label">Scrutins</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{data.stats.votes}</div>
		<div class="stat-label">Votes enregistrés</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{data.stats.groups}</div>
		<div class="stat-label">Groupes parlementaires</div>
	</div>
</div>

<div class="card-grid">
	<section class="card">
		<h2>Derniers scrutins</h2>
		<div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
			{#each data.recentScrutins as scrutin}
				{@const total = scrutin.totalFor + scrutin.totalAgainst + scrutin.totalAbstention || 1}
				<a href="/scrutins/{scrutin.id}" class="scrutin-card" class:adopted={scrutin.result === 'adopté'} class:rejected={scrutin.result === 'rejeté'}>
					<div class="scrutin-title">{scrutin.title.slice(0, 100)}{scrutin.title.length > 100 ? '...' : ''}</div>
					<div class="scrutin-meta">
						<span>{new Date(scrutin.date).toLocaleDateString('fr-FR')}</span>
						<span class="scrutin-result" class:adopted={scrutin.result === 'adopté'} class:rejected={scrutin.result === 'rejeté'}>
							{scrutin.result}
						</span>
						<span>{scrutin.totalVoters} votants</span>
					</div>
					<div class="vote-bar">
						<div class="vote-bar-for" style="width: {(scrutin.totalFor / total) * 100}%"></div>
						<div class="vote-bar-against" style="width: {(scrutin.totalAgainst / total) * 100}%"></div>
						<div class="vote-bar-abstention" style="width: {(scrutin.totalAbstention / total) * 100}%"></div>
					</div>
				</a>
			{/each}
		</div>
		<div style="margin-top: 1rem; text-align: center;">
			<a href="/scrutins" class="btn btn-secondary">Voir tous les scrutins</a>
		</div>
	</section>

	<section class="card">
		<h2>Groupes parlementaires</h2>
		<div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
			{#each data.groups as group}
				<a href="/groupes/{group.id}" style="display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: inherit;">
					<span style="width: 12px; height: 12px; border-radius: 50%; background: {group.color || '#ccc'}"></span>
					<span style="flex: 1">{group.name}</span>
					<span class="badge">{group.shortName}</span>
				</a>
			{/each}
		</div>
	</section>
</div>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.scrutin-card {
		display: block;
		text-decoration: none;
		color: inherit;
	}

	.scrutin-card:hover {
		text-decoration: none;
	}
</style>
