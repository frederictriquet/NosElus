<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Thèmes — NosElus</title>
	<meta
		name="description"
		content="Explorez les votes parlementaires par grands sujets du quotidien"
	/>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Thèmes</h1>
	<p class="page-subtitle">
		Explorez les positions des groupes politiques par sujet du quotidien, sur la base des votes
		officiels à l'Assemblée nationale.
	</p>
</div>

{#if data.themes.length === 0}
	<div class="empty-state">
		<p>Aucun thème disponible pour l'instant.</p>
	</div>
{:else}
	<div class="themes-grid">
		{#each data.themes as theme}
			<div class="theme-card">
				<div class="theme-header">
					<span class="theme-dot" style="background: {theme.color ?? '#64748b'}"></span>
					<h2 class="theme-name">{theme.name}</h2>
					<span class="theme-count"
						>{theme.scrutinCount} scrutin{theme.scrutinCount > 1 ? 's' : ''}</span
					>
				</div>

				{#if theme.groupBilans.length > 0}
					<ul class="bilan-list">
						{#each theme.groupBilans.slice(0, 4) as bilan}
							{@const dominant =
								bilan.scrutinsPour >= bilan.scrutinsContre &&
								bilan.scrutinsPour >= bilan.scrutinsAbstention
									? 'pour'
									: bilan.scrutinsContre >= bilan.scrutinsPour &&
										  bilan.scrutinsContre >= bilan.scrutinsAbstention
										? 'contre'
										: 'abstention'}
							<li class="bilan-row">
								<span class="group-name">{bilan.shortName}</span>
								<span class="bilan-bar">
									<span
										class="bilan-fill {dominant}"
										style="width: {(bilan[
											dominant === 'pour'
												? 'scrutinsPour'
												: dominant === 'contre'
													? 'scrutinsContre'
													: 'scrutinsAbstention'
										] /
											bilan.totalScrutins) *
											100}%"
									></span>
								</span>
								<span class="bilan-label {dominant}">
									{dominant === 'pour' ? '✅' : dominant === 'contre' ? '❌' : '🟡'}
									{bilan[
										dominant === 'pour'
											? 'scrutinsPour'
											: dominant === 'contre'
												? 'scrutinsContre'
												: 'scrutinsAbstention'
									]}/{bilan.totalScrutins}
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				<a href="/themes/{theme.slug}" class="theme-link">Voir la fiche →</a>
			</div>
		{/each}
	</div>
{/if}

<style>
	.themes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 1.5rem;
	}

	.theme-card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.theme-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.theme-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.theme-name {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0;
		flex: 1;
	}

	.theme-count {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.bilan-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.bilan-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}

	.group-name {
		width: 4rem;
		font-weight: 600;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.bilan-bar {
		flex: 1;
		height: 6px;
		background: var(--color-bg);
		border-radius: 3px;
		overflow: hidden;
	}

	.bilan-fill {
		display: block;
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.bilan-fill.pour {
		background: var(--color-success);
	}

	.bilan-fill.contre {
		background: var(--color-danger);
	}

	.bilan-fill.abstention {
		background: var(--color-warning);
	}

	.bilan-label {
		font-size: 0.75rem;
		font-weight: 600;
		width: 4rem;
		text-align: right;
		flex-shrink: 0;
	}

	.bilan-label.pour {
		color: var(--color-success);
	}

	.bilan-label.contre {
		color: var(--color-danger);
	}

	.bilan-label.abstention {
		color: var(--color-warning-text, #92400e);
	}

	.theme-link {
		display: inline-block;
		margin-top: auto;
		font-size: 0.875rem;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
	}

	.theme-link:hover {
		text-decoration: underline;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--color-text-muted);
	}

	@media (max-width: 640px) {
		.themes-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
