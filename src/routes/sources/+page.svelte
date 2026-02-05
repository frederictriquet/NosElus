<script lang="ts">
	const sources = [
		{
			category: 'Assemblee Nationale',
			items: [
				{
					name: 'Open Data Assemblee Nationale',
					url: 'https://data.assemblee-nationale.fr/',
					description:
						"Donnees officielles de l'Assemblee nationale : deputes, scrutins, amendements, dossiers legislatifs",
					data: ['Deputes', 'Scrutins', 'Votes', 'Amendements', 'Dossiers legislatifs']
				},
				{
					name: 'NosDéputés.fr',
					url: 'https://www.nosdeputes.fr/',
					description: "Statistiques d'activite parlementaire des deputes",
					data: ["Statistiques d'activite", 'Presence', 'Interventions']
				}
			]
		},
		{
			category: 'Senat',
			items: [
				{
					name: 'data.senat.fr',
					url: 'https://data.senat.fr/',
					description:
						'Portail open data du Senat : senateurs, amendements, questions, dossiers legislatifs',
					data: ['Senateurs', 'Groupes politiques', 'Commissions', 'Dossiers legislatifs']
				},
				{
					name: "Calendrier d'activite (senat.fr)",
					url: 'https://www.senat.fr/calendrier_activite/',
					description: 'Tableau des activites principales des senateurs',
					data: ['Presences en seance', 'Presences en commission', 'Questions au gouvernement']
				},
				{
					name: 'API Senateurs',
					url: 'https://www.senat.fr/api-senat/senateurs.json',
					description: 'API JSON des senateurs en exercice',
					data: ['Informations senateurs', 'Groupes', 'Commissions']
				},
				{
					name: 'NosSénateurs.fr (archive)',
					url: 'https://archive.nossenateurs.fr/',
					description: "Statistiques d'activite parlementaire des senateurs (archive)",
					data: ['Semaines de presence', 'Interventions', 'Amendements', 'Questions']
				}
			]
		},
		{
			category: 'Parlement Europeen',
			items: [
				{
					name: 'ParlTrack',
					url: 'https://parltrack.org/',
					description: 'Donnees sur les eurodeputes et leurs activites',
					data: ['Eurodeputes', 'Groupes politiques', 'Mandats']
				},
				{
					name: 'HowTheyVote.eu',
					url: 'https://howtheyvote.eu/',
					description: 'Votes nominatifs du Parlement europeen',
					data: ['Scrutins', 'Votes individuels', 'Positions des groupes']
				},
				{
					name: 'Open Data Parlement Europeen',
					url: 'https://data.europarl.europa.eu/',
					description: 'Portail open data officiel du Parlement europeen',
					data: ['Eurodeputes', 'Documents', 'Procedures']
				}
			]
		},
		{
			category: 'Autres sources',
			items: [
				{
					name: 'Datan.fr',
					url: 'https://datan.fr/',
					description: "Plateforme independante de suivi de l'Assemblee nationale",
					data: ['Analyses de votes', 'Coalitions', 'Statistiques']
				},
				{
					name: 'data.gouv.fr',
					url: 'https://www.data.gouv.fr/',
					description: 'Plateforme nationale des donnees ouvertes',
					data: ['Datasets parlementaires', 'Elections']
				},
				{
					name: 'Tricoteuses',
					url: 'https://www.tricoteuses.fr/',
					description: "Bibliotheque TypeScript pour les donnees de l'Assemblee nationale",
					data: ['Parsing des donnees AN']
				}
			]
		}
	];
</script>

<svelte:head>
	<title>Sources de donnees - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Sources de donnees</h1>
	<p class="page-subtitle">
		NosElus agrege des donnees provenant de multiples sources ouvertes sur les parlementaires
		francais et europeens
	</p>
</div>

<div class="sources-container">
	{#each sources as category}
		<section class="source-category">
			<h2>{category.category}</h2>
			<div class="sources-grid">
				{#each category.items as source}
					<article class="source-card">
						<h3>
							<a href={source.url} target="_blank" rel="noopener noreferrer">
								{source.name}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
									<polyline points="15 3 21 3 21 9" />
									<line x1="10" x2="21" y1="14" y2="3" />
								</svg>
							</a>
						</h3>
						<p class="source-description">{source.description}</p>
						<div class="source-data">
							{#each source.data as item}
								<span class="data-tag">{item}</span>
							{/each}
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/each}
</div>

<section class="license-section">
	<h2>Licences et attributions</h2>
	<p>
		Les donnees utilisees par NosElus sont issues de sources ouvertes et sont soumises aux licences
		de leurs editeurs respectifs. Nous remercions l'ensemble des organisations qui rendent ces
		donnees publiques.
	</p>
	<ul>
		<li><strong>Assemblee nationale</strong> - Licence Ouverte / Open Licence</li>
		<li><strong>Senat</strong> - Licence propre data.senat.fr</li>
		<li><strong>Parlement europeen</strong> - European Parliament Legal Notice</li>
		<li><strong>HowTheyVote.eu</strong> - Open Database License (ODbL)</li>
		<li><strong>ParlTrack</strong> - Public Domain</li>
	</ul>
</section>

<style>
	.sources-container {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.source-category h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--color-text);
		padding-bottom: 0.5rem;
		border-bottom: 2px solid var(--color-primary);
	}

	.sources-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}

	.source-card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		box-shadow: var(--shadow-sm);
		transition:
			box-shadow 0.2s,
			transform 0.2s;
	}

	.source-card:hover {
		box-shadow: var(--shadow);
		transform: translateY(-2px);
	}

	.source-card h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
	}

	.source-card h3 a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-primary);
		text-decoration: none;
	}

	.source-card h3 a:hover {
		text-decoration: underline;
	}

	.source-card h3 svg {
		flex-shrink: 0;
		opacity: 0.7;
	}

	.source-description {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0 0 0.75rem 0;
		line-height: 1.5;
	}

	.source-data {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.data-tag {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: var(--color-bg);
		border-radius: 4px;
		color: var(--color-text-muted);
	}

	.license-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}

	.license-section h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
	}

	.license-section p {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0 0 1rem 0;
		line-height: 1.6;
	}

	.license-section ul {
		margin: 0;
		padding-left: 1.5rem;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.license-section li {
		margin-bottom: 0.5rem;
	}

	.license-section strong {
		color: var(--color-text);
	}

	@media (max-width: 640px) {
		.sources-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
