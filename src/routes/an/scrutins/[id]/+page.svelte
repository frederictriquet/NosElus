<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import VoteDistributionCard from '$lib/components/VoteDistributionCard.svelte';
	import LawSummaryCard from '$lib/components/LawSummaryCard.svelte';
	import GroupVotesStackedBar from '$lib/components/GroupVotesStackedBar.svelte';

	let { data } = $props();

	const categoryLabels: Record<string, string> = {
		'vote-final': 'Vote final',
		amendement: 'Amendement',
		article: 'Article',
		procedure: 'Procédure',
		budget: 'Budget',
		constitutionnel: 'Constitutionnel',
		autre: 'Autre'
	};

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	const typeLabels: Record<string, string> = {
		PJL: 'Projet de loi',
		PPL: 'Proposition de loi',
		PJLF: 'Projet de loi de finances',
		PJLFSS: 'Projet de loi de financement de la sécurité sociale'
	};
</script>

<svelte:head>
	<title>Scrutin n°{data.scrutin.number} - NosElus</title>
</svelte:head>

<div class="page-header">
	<div class="scrutin-badges">
		<span class="scrutin-number">Scrutin n°{data.scrutin.number}</span>
		{#if data.scrutin.category}
			<span class="category-badge"
				>{categoryLabels[data.scrutin.category] || data.scrutin.category}</span
			>
		{/if}
		{#if data.scrutin.result}
			<span
				class="result-badge"
				class:adopted={data.scrutin.result === 'adopté'}
				class:rejected={data.scrutin.result === 'rejeté'}
			>
				{data.scrutin.result}
			</span>
		{/if}
		{#if data.isTightVote && data.tightLabel}
			<span
				class="tight-vote-badge"
				class:tie={data.scrutin.margin === 0}
				title="Marge de {data.scrutin.margin} voix"
			>
				{data.tightLabel}
			</span>
		{/if}
	</div>
	<h1 class="page-title">{data.scrutin.title}</h1>
	<p class="page-subtitle">{formatDate(data.scrutin.date)}</p>
</div>

<!-- Related Law -->
{#await data.relatedLaw then law}
	{#if law}
		<section class="card law-link-card">
			<h2>Dossier législatif</h2>
			<p class="matching-disclaimer">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="16" x2="12" y2="12"></line>
					<line x1="12" y1="8" x2="12.01" y2="8"></line>
				</svg>
				<span
					>Ce dossier est associé automatiquement par similarité de titre, car les données
					officielles ne fournissent pas de lien direct entre scrutins et textes de loi. Il est
					possible que ce ne soit pas exactement le bon texte.</span
				>
			</p>
			<a href="/an/laws/{law.id}" class="law-link">
				<div class="law-type">{typeLabels[law.type] || law.type}</div>
				<div class="law-title">{law.shortTitle || law.title}</div>
				{#if law.status}
					<span
						class="law-status"
						class:status-adopted={law.status === 'adopté' || law.status === 'promulgué'}
						class:status-rejected={law.status === 'rejeté'}
					>
						{law.status}
					</span>
				{/if}
			</a>
			{#if law.summary}
				<LawSummaryCard
					summary={law.summary}
					tags={law.tags || []}
					model={law.summaryModel ?? undefined}
					class="law-summary-section"
				/>
			{:else}
				<p class="no-summary-notice">Résumé IA non disponible pour ce texte.</p>
			{/if}
			{#if law.title || law.description}
				<details class="law-details">
					<summary class="law-details-toggle">
						<span>Voir le texte complet</span>
						<svg
							class="chevron"
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
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</summary>
					<div class="law-full-text">
						<h3>Intitulé complet</h3>
						<p class="law-title-full">{law.title}</p>

						<h3>Description</h3>
						{#if law.description}
							<p class="law-description">{law.description}</p>
						{:else}
							<p class="law-no-data">Aucune description disponible pour ce texte.</p>
						{/if}

						<h3>Source officielle</h3>
						{#if law.sourceUrl}
							<a
								href={law.sourceUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="law-source-link"
							>
								Voir sur le site de l'Assemblée nationale
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
									<polyline points="15 3 21 3 21 9"></polyline>
									<line x1="10" y1="14" x2="21" y2="3"></line>
								</svg>
							</a>
						{:else}
							<p class="law-no-data">Aucun lien vers la source officielle disponible.</p>
						{/if}
					</div>
				</details>
			{/if}
		</section>
	{:else}
		<section class="card law-link-card no-law-card">
			<h2>Dossier législatif</h2>
			<div class="no-law-notice">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="16" x2="12" y2="12"></line>
					<line x1="12" y1="8" x2="12.01" y2="8"></line>
				</svg>
				<div class="no-law-content">
					<p class="no-law-title">Aucun dossier législatif associé</p>
					<p class="no-law-explanation">
						Ce scrutin n'a pas pu être automatiquement associé à un dossier législatif. Cela peut
						arriver pour plusieurs raisons :
					</p>
					<ul class="no-law-reasons">
						<li>
							Le scrutin porte sur une motion de procédure ou un amendement sans dossier principal
							identifiable
						</li>
						<li>
							Le titre du scrutin ne correspond pas assez aux titres des dossiers législatifs connus
						</li>
						<li>Le dossier législatif n'est pas encore disponible dans notre base de données</li>
					</ul>
					<p class="no-law-suggestion">
						Vous pouvez rechercher le texte concerné sur
						<a
							href="https://www.assemblee-nationale.fr/dyn/{data.scrutin.legislature}/dossiers"
							target="_blank"
							rel="noopener noreferrer"
						>
							le site de l'Assemblée nationale
						</a>.
					</p>
				</div>
			</div>
		</section>
	{/if}
{/await}

<!-- Results summary -->
<div class="stats-grid" style="margin-top: 1.5rem;">
	<div class="stat-card">
		<div class="stat-value">{data.scrutin.totalVoters}</div>
		<div class="stat-label">Votants</div>
	</div>
	<div class="stat-card">
		<div class="stat-value" style="color: var(--color-success);">{data.scrutin.totalFor}</div>
		<div class="stat-label">Pour</div>
	</div>
	<div class="stat-card">
		<div class="stat-value" style="color: var(--color-danger);">{data.scrutin.totalAgainst}</div>
		<div class="stat-label">Contre</div>
	</div>
	<div class="stat-card">
		<div class="stat-value" style="color: var(--color-text-muted);">
			{data.scrutin.totalAbstention}
		</div>
		<div class="stat-label">Abstentions</div>
	</div>
</div>

<!-- Vote distribution chart -->
<div style="margin-top: 1.5rem;">
	<VoteDistributionCard
		distribution={{
			pour: data.scrutin.totalFor,
			contre: data.scrutin.totalAgainst,
			abstention: data.scrutin.totalAbstention,
			'non-votant': data.scrutin.totalNonVoting
		}}
	/>
</div>

<!-- Stacked bar charts -->
<div class="charts-row">
	<AsyncCard title="Votes par groupe" promise={data.groupBreakdown} minHeight="280px">
		{#snippet children(groups)}
			<GroupVotesStackedBar {groups} mode="by-group" height={220} />
		{/snippet}
	</AsyncCard>

	<AsyncCard title="Répartition par position" promise={data.groupBreakdown} minHeight="280px">
		{#snippet children(groups)}
			<GroupVotesStackedBar {groups} mode="by-position" height={220} rotateLabels={false} />
		{/snippet}
	</AsyncCard>
</div>

<!-- Individual voters -->
<div style="margin-top: 1.5rem;">
	<AsyncCard title="Votes individuels" promise={data.voters} minHeight="200px">
		{#snippet children(voters)}
			{#if voters.length === 0}
				<p class="empty-state">Aucun vote individuel</p>
			{:else}
				<div class="voters-grid">
					{#each voters as voter}
						<a
							href="/an/deputes/{voter.actorId}"
							class="voter-card"
							data-position={voter.position?.toLowerCase()}
						>
							{#if voter.actorPhoto}
								<img src={voter.actorPhoto} alt="" class="voter-photo" />
							{:else}
								<div class="voter-photo placeholder"></div>
							{/if}
							<div class="voter-info">
								<div class="voter-name">{voter.actorName}</div>
								{#if voter.groupName}
									<div class="voter-group" style="color: {voter.groupColor || 'inherit'}">
										{voter.groupName}
									</div>
								{/if}
							</div>
							<div class="voter-position">{voter.position}</div>
						</a>
					{/each}
				</div>
			{/if}
		{/snippet}
	</AsyncCard>
</div>

<!-- Info -->
<section class="card" style="margin-top: 1.5rem;">
	<h2>Informations</h2>
	<dl class="info-list">
		<div class="info-row">
			<dt>Numéro</dt>
			<dd>{data.scrutin.number}</dd>
		</div>
		<div class="info-row">
			<dt>Législature</dt>
			<dd>{data.scrutin.legislature}</dd>
		</div>
		<div class="info-row">
			<dt>Type</dt>
			<dd>{data.scrutin.type}</dd>
		</div>
		{#if data.scrutin.sortType}
			<div class="info-row">
				<dt>Sort</dt>
				<dd>{data.scrutin.sortType}</dd>
			</div>
		{/if}
		{#if data.scrutin.sessionOrdinary}
			<div class="info-row">
				<dt>Session</dt>
				<dd>{data.scrutin.sessionOrdinary}</dd>
			</div>
		{/if}
		{#if data.scrutin.description}
			<div class="info-row full-width">
				<dt>Description</dt>
				<dd>{data.scrutin.description}</dd>
			</div>
		{/if}
	</dl>
</section>

<style>
	.charts-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	@media (max-width: 900px) {
		.charts-row {
			grid-template-columns: 1fr;
		}
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.scrutin-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.scrutin-number {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.category-badge {
		padding: 0.125rem 0.5rem;
		background: var(--color-primary-bg);
		color: var(--color-primary);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}

	.result-badge {
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.result-badge.adopted {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.result-badge.rejected {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.tight-vote-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		background-color: var(--color-warning-bg);
		color: var(--color-warning);
		border: 1px solid var(--color-warning-border);
	}

	.tight-vote-badge.tie {
		background-color: var(--color-info-bg);
		color: var(--color-info);
		border-color: var(--color-info-border);
	}

	/* Law link card */
	.law-link-card {
		margin-top: 1.5rem;
	}

	.law-link {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		transition: all 0.2s;
	}

	.law-link:hover {
		background: var(--color-bg-hover);
	}

	.law-type {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.law-title {
		flex: 1;
		font-weight: 500;
	}

	.law-status {
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}

	.law-status.status-adopted {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.law-status.status-rejected {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.law-link-card :global(.law-summary-section) {
		margin-top: 1rem;
	}

	.no-summary-notice {
		margin: 1rem 0 0;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		font-style: italic;
		color: var(--color-text-muted);
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		border-left: 3px solid var(--color-border);
	}

	.matching-disclaimer {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 0.625rem 0.875rem;
		font-size: 0.8125rem;
		color: var(--color-warning);
		background: var(--color-warning-bg);
		border: 1px solid var(--color-warning-border);
		border-radius: var(--radius-md);
	}

	.matching-disclaimer svg {
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.matching-disclaimer span {
		line-height: 1.4;
	}

	/* No law associated */
	.no-law-notice {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		border: 1px dashed var(--color-border);
	}

	.no-law-notice svg {
		flex-shrink: 0;
		color: var(--color-text-muted);
		opacity: 0.6;
	}

	.no-law-content {
		flex: 1;
	}

	.no-law-title {
		margin: 0 0 0.5rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.no-law-explanation {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.no-law-reasons {
		margin: 0 0 0.75rem;
		padding-left: 1.25rem;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.no-law-reasons li {
		margin-bottom: 0.25rem;
	}

	.no-law-suggestion {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.no-law-suggestion a {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.no-law-suggestion a:hover {
		color: var(--color-primary-hover);
	}

	/* Law details (collapsible) */
	.law-details {
		margin-top: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.law-details-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: var(--color-bg-secondary);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		transition: all 0.2s;
		list-style: none;
	}

	.law-details-toggle::-webkit-details-marker {
		display: none;
	}

	.law-details-toggle:hover {
		background: var(--color-bg-hover);
		color: var(--color-text);
	}

	.law-details-toggle .chevron {
		transition: transform 0.2s;
	}

	.law-details[open] .law-details-toggle .chevron {
		transform: rotate(180deg);
	}

	.law-full-text {
		padding: 1rem;
		background: var(--color-bg);
		border-top: 1px solid var(--color-border);
	}

	.law-full-text h3 {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.025em;
		margin: 0 0 0.5rem;
	}

	.law-full-text h3:not(:first-child) {
		margin-top: 1rem;
	}

	.law-title-full {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.6;
	}

	.law-description {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-text-muted);
		white-space: pre-wrap;
	}

	.law-no-data {
		margin: 0;
		font-size: 0.875rem;
		font-style: italic;
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.law-source-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 1rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		color: var(--color-primary);
		background: var(--color-primary-bg);
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition: all 0.2s;
	}

	.law-source-link:hover {
		background: var(--color-primary);
		color: white;
	}

	/* Voters grid */
	.voters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 0.5rem;
	}

	.voter-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		border-left: 3px solid transparent;
		transition: all 0.2s;
	}

	.voter-card:hover {
		background: var(--color-bg-hover);
	}

	.voter-card[data-position='pour'] {
		border-left-color: var(--color-success);
	}

	.voter-card[data-position='contre'] {
		border-left-color: var(--color-danger);
	}

	.voter-card[data-position='abstention'] {
		border-left-color: var(--color-warning);
	}

	.voter-photo {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.voter-photo.placeholder {
		background: var(--color-border);
	}

	.voter-info {
		flex: 1;
		min-width: 0;
	}

	.voter-name {
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.voter-group {
		font-size: 0.75rem;
	}

	.voter-position {
		font-size: 0.75rem;
		text-transform: capitalize;
		color: var(--color-text-muted);
	}

	/* Info list */
	.info-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin: 0;
	}

	.info-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-row.full-width {
		grid-column: 1 / -1;
	}

	.info-row dt {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.info-row dd {
		margin: 0;
		font-size: 0.875rem;
	}
</style>
