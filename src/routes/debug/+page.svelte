<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Debug - NosElus</title>
</svelte:head>

<div class="debug-page">
	<h1>Debug - AI Summaries</h1>
	<p class="dev-warning">Cette page est visible uniquement en mode développement.</p>

	<section class="stats-section">
		<h2>Statistiques</h2>
		<div class="stats-grid">
			<div class="stat">
				<span class="stat-value">{data.stats.totalLaws}</span>
				<span class="stat-label">Lois totales</span>
			</div>
			<div class="stat">
				<span class="stat-value">{data.stats.lawsWithText}</span>
				<span class="stat-label">Avec texte complet</span>
			</div>
			<div class="stat">
				<span class="stat-value">{data.stats.lawsWithSummary}</span>
				<span class="stat-label">Avec résumé IA</span>
			</div>
			<div class="stat">
				<span class="stat-value">{data.stats.lawsWithTextNoSummary}</span>
				<span class="stat-label">Texte sans résumé</span>
			</div>
		</div>
	</section>

	<section class="laws-section">
		<h2>Lois avec résumé IA ({data.lawsWithSummaries.length})</h2>
		<table class="laws-table">
			<thead>
				<tr>
					<th>Lien</th>
					<th>Titre</th>
					<th>Résumé</th>
					<th>Tags</th>
					<th>Modèle</th>
				</tr>
			</thead>
			<tbody>
				{#each data.lawsWithSummaries as law}
					<tr>
						<td><a href="/an/laws/{law.id}" target="_blank">{law.id}</a></td>
						<td class="title-cell">{law.title || law.fullTitle}</td>
						<td class="summary-cell">{law.summary}</td>
						<td class="tags-cell">
							{#if Array.isArray(law.tags)}
								{law.tags.join(', ')}
							{/if}
						</td>
						<td>{law.model}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	{#if data.lawsWithTextNoSummary.length > 0}
		<section class="laws-section">
			<h2>Lois avec texte mais sans résumé ({data.lawsWithTextNoSummary.length})</h2>
			<table class="laws-table">
				<thead>
					<tr>
						<th>Lien</th>
						<th>Titre</th>
					</tr>
				</thead>
				<tbody>
					{#each data.lawsWithTextNoSummary as law}
						<tr>
							<td><a href="/an/laws/{law.id}" target="_blank">{law.id}</a></td>
							<td>{law.title || law.fullTitle}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>

<style>
	.debug-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 0.5rem;
	}

	.dev-warning {
		background: var(--color-warning-bg);
		color: var(--color-warning);
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md);
		margin-bottom: 2rem;
		font-size: 0.875rem;
	}

	.stats-section {
		margin-bottom: 2rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.stat {
		background: var(--color-bg-secondary);
		padding: 1rem;
		border-radius: var(--radius-md);
		text-align: center;
	}

	.stat-value {
		display: block;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.laws-section {
		margin-bottom: 2rem;
	}

	h2 {
		margin-bottom: 1rem;
		font-size: 1.25rem;
	}

	.laws-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
	}

	.laws-table th,
	.laws-table td {
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		text-align: left;
		vertical-align: top;
	}

	.laws-table th {
		background: var(--color-bg-secondary);
		font-weight: 600;
	}

	.laws-table tr:hover {
		background: var(--color-bg-hover);
	}

	.title-cell {
		max-width: 250px;
	}

	.summary-cell {
		max-width: 400px;
	}

	.tags-cell {
		max-width: 150px;
		font-size: 0.75rem;
	}

	a {
		color: var(--color-primary);
	}
</style>
