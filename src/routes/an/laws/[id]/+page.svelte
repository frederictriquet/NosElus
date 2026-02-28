<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import LawSummaryCard from '$lib/components/LawSummaryCard.svelte';

	let { data } = $props();

	const typeLabels: Record<string, string> = {
		PJL: 'Projet de loi',
		PPL: 'Proposition de loi',
		PJLF: 'Projet de loi de finances',
		PJLFSS: 'Projet de loi de financement de la sécurité sociale',
		PJLR: 'Projet de loi de règlement',
		PJC: 'Projet de loi constitutionnelle',
		PPC: 'Proposition de loi constitutionnelle'
	};

	const statusLabels: Record<string, string> = {
		'en cours': 'En cours',
		adopté: 'Adopté',
		rejeté: 'Rejeté',
		promulgué: 'Promulgué',
		retiré: 'Retiré'
	};

	const initiatorLabels: Record<string, string> = {
		gouvernement: 'Gouvernement',
		assemblée: 'Assemblée nationale',
		sénat: 'Sénat'
	};

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function getStatusExplanation(status: string | null): string {
		switch (status) {
			case 'en cours':
				return 'Ce dossier est en cours d\u2019examen parlementaire.';
			case 'retiré':
				return 'Ce dossier a été retiré.';
			case 'adopté':
				return 'Ce dossier a été adopté par le Parlement.';
			case 'promulgué':
				return 'Ce dossier a été promulgué.';
			case 'rejeté':
				return 'Ce dossier a été rejeté par le Parlement.';
			default:
				return '';
		}
	}

	function getScrutinExplanation(status: string | null, count: number): string {
		if (count > 0) {
			return count === 1
				? 'Un scrutin solennel en séance publique est rattaché à ce dossier.'
				: `${count} scrutins solennels en séance publique sont rattachés à ce dossier.`;
		}
		switch (status) {
			case 'en cours':
				return 'Ce dossier n\u2019a pas encore fait l\u2019objet de scrutins en séance publique.';
			case 'retiré':
				return 'Ce dossier a été retiré avant d\u2019avoir fait l\u2019objet de scrutins en séance publique.';
			default:
				return 'Aucun scrutin solennel en séance publique n\u2019est rattaché à ce dossier dans nos données.';
		}
	}

	function getSummaryExplanation(hasSummary: boolean): string {
		if (hasSummary) return '';
		return 'Le résumé automatique n\u2019a pas encore été généré pour ce dossier.';
	}

	function getContributorsExplanation(status: string | null, count: number): string {
		if (count > 0) return '';
		if (status === 'en cours' || status === 'retiré') {
			return 'Aucun auteur ou cosignataire parlementaire n\u2019est enregistré pour ce dossier.';
		}
		return 'Aucun auteur ou cosignataire parlementaire n\u2019est rattaché à ce dossier dans nos données.';
	}
</script>

<svelte:head>
	<title>{data.law.shortTitle || data.law.title} - NosElus</title>
</svelte:head>

<div class="page-header">
	<div class="law-type-badge">{typeLabels[data.law.type] || data.law.type}</div>
	<h1 class="page-title">{data.law.title}</h1>
	{#if data.law.shortTitle && data.law.shortTitle !== data.law.title}
		<p class="page-subtitle">{data.law.shortTitle}</p>
	{/if}
</div>

{#if getStatusExplanation(data.law.status)}
	<div
		class="status-context"
		class:status-context-pending={data.law.status === 'en cours'}
		class:status-context-adopted={data.law.status === 'adopté' || data.law.status === 'promulgué'}
		class:status-context-rejected={data.law.status === 'rejeté'}
		class:status-context-withdrawn={data.law.status === 'retiré'}
	>
		<p>{getStatusExplanation(data.law.status)}</p>
	</div>
{/if}

<!-- Timeline -->
{#if data.timeline.length > 0}
	<section class="card timeline-card">
		<h2>Parcours législatif</h2>
		<div class="timeline">
			{#each data.timeline as event, i}
				<div class="timeline-event" data-type={event.type}>
					<div class="timeline-marker"></div>
					<div class="timeline-content">
						<div class="timeline-date">{formatDate(event.date)}</div>
						<div class="timeline-label">{event.label}</div>
					</div>
					{#if i < data.timeline.length - 1}
						<div class="timeline-connector"></div>
					{/if}
				</div>
			{/each}
		</div>
	</section>
{/if}

<!-- AI Summary -->
<AsyncCard title="Résumé" promise={data.aiSummary}>
	{#snippet children(summary)}
		{#if summary}
			<LawSummaryCard summary={summary.summary} tags={summary.tags || []} model={summary.model} />
		{:else}
			<p class="empty-state-contextual">{getSummaryExplanation(false)}</p>
		{/if}
	{/snippet}
</AsyncCard>

<!-- Stats -->
<AsyncCard title="Scrutins liés" promise={data.scrutinStats}>
	{#snippet children(stats)}
		<p class="section-context">{getScrutinExplanation(data.law.status, stats.total)}</p>
		{#if stats.total === 0}
			<!-- pas de stats à afficher -->
		{:else}
			<div class="stats-grid" style="margin-bottom: 1rem;">
				<div class="stat-card">
					<div class="stat-value">{stats.total}</div>
					<div class="stat-label">Scrutins</div>
				</div>
				{#each stats.byResult as { result, count }}
					{#if result}
						<div class="stat-card">
							<div
								class="stat-value"
								style="color: {result === 'adopté'
									? 'var(--color-success)'
									: 'var(--color-danger)'};"
							>
								{count}
							</div>
							<div class="stat-label">{result === 'adopté' ? 'Adoptés' : 'Rejetés'}</div>
						</div>
					{/if}
				{/each}
			</div>

			{#if stats.byCategory.length > 0}
				<div class="category-breakdown">
					<h3>Par type de scrutin</h3>
					<div class="category-chips">
						{#each stats.byCategory as { category, count }}
							<span class="category-chip">
								{category || 'Non classé'}: {count}
							</span>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	{/snippet}
</AsyncCard>

<!-- Related Scrutins -->
<div style="margin-top: 1.5rem;">
	<AsyncCard title="Liste des scrutins" promise={data.relatedScrutins} minHeight="200px">
		{#snippet children(scrutins)}
			{#if scrutins.length === 0}
				<!-- message contextuel déjà affiché dans la section stats -->
			{:else}
				<div class="scrutins-list">
					{#each scrutins as scrutin}
						<a href="/an/scrutins/{scrutin.id}" class="scrutin-item">
							<div class="scrutin-header">
								<span class="scrutin-number">n°{scrutin.number}</span>
								<span class="scrutin-date"
									>{new Date(scrutin.date).toLocaleDateString('fr-FR')}</span
								>
								{#if scrutin.result}
									<span
										class="scrutin-result"
										class:adopted={scrutin.result === 'adopté'}
										class:rejected={scrutin.result === 'rejeté'}
									>
										{scrutin.result}
									</span>
								{/if}
							</div>
							<div class="scrutin-title">{scrutin.title}</div>
							<div class="scrutin-meta">
								{#if scrutin.category}
									<span class="scrutin-category">{scrutin.category}</span>
								{/if}
								<span class="scrutin-votes">
									<span class="vote-for">{scrutin.totalFor} pour</span>
									<span class="vote-against">{scrutin.totalAgainst} contre</span>
									<span class="vote-abstention">{scrutin.totalAbstention} abst.</span>
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/snippet}
	</AsyncCard>

	<AsyncCard title="Contributeurs" promise={data.contributors} minHeight="200px">
		{#snippet children(contributors)}
			{#if contributors.length === 0}
				<p class="empty-state-contextual">{getContributorsExplanation(data.law.status, 0)}</p>
			{:else}
				{@const authors = contributors.filter((c) => c.role === 'author')}
				{@const cosignatories = contributors.filter((c) => c.role === 'cosignatory')}

				<div class="contributors-section">
					{#if authors.length > 0}
						<div class="contributor-group">
							<h3 class="contributor-group-title">
								Auteur{authors.length > 1 ? 's' : ''} ({authors.length})
							</h3>
							<div class="contributor-list">
								{#each authors as contributor}
									<a
										href="/an/deputes/{contributor.actorId}"
										class="contributor-item"
										title="Voir le profil du député"
									>
										{contributor.actorName}
									</a>
								{/each}
							</div>
						</div>
					{/if}

					{#if cosignatories.length > 0}
						<div class="contributor-group">
							<h3 class="contributor-group-title">Cosignataires ({cosignatories.length})</h3>
							<div class="contributor-list">
								{#each cosignatories as contributor}
									<a
										href="/an/deputes/{contributor.actorId}"
										class="contributor-item"
										title="Voir le profil du député"
									>
										{contributor.actorName}
									</a>
								{/each}
							</div>
						</div>
					{/if}
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
			<dt>Type</dt>
			<dd>{typeLabels[data.law.type] || data.law.type}</dd>
		</div>
		<div class="info-row">
			<dt>Statut</dt>
			<dd>
				<span
					class="status-badge"
					class:status-adopted={data.law.status === 'adopté' || data.law.status === 'promulgué'}
					class:status-rejected={data.law.status === 'rejeté'}
					class:status-pending={data.law.status === 'en cours'}
				>
					{statusLabels[data.law.status || ''] || data.law.status || 'Inconnu'}
				</span>
			</dd>
		</div>
		<div class="info-row">
			<dt>Législature</dt>
			<dd>{data.law.legislature}</dd>
		</div>
		{#if data.law.number}
			<div class="info-row">
				<dt>Numéro</dt>
				<dd>{data.law.number}</dd>
			</div>
		{/if}
		{#if data.law.initiator}
			<div class="info-row">
				<dt>Initiateur</dt>
				<dd>{initiatorLabels[data.law.initiator] || data.law.initiator}</dd>
			</div>
		{/if}
		{#if data.law.theme}
			<div class="info-row">
				<dt>Thème</dt>
				<dd>{data.law.theme}</dd>
			</div>
		{/if}
		{#if data.law.description}
			<div class="info-row full-width">
				<dt>Description</dt>
				<dd class="law-description">{data.law.description}</dd>
			</div>
		{/if}
		{#if data.law.sourceUrl}
			<div class="info-row">
				<dt>Source</dt>
				<dd>
					<a
						href={data.law.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="external-link"
					>
						Voir sur le site de l'AN
					</a>
				</dd>
			</div>
		{/if}
	</dl>
</section>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	h3 {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		margin-bottom: 0.5rem;
	}

	/* Status context banner */
	.status-context {
		margin-top: 1.5rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		line-height: 1.5;
		border-left: 3px solid var(--color-border);
		background: var(--color-bg-secondary);
	}

	.status-context p {
		margin: 0;
	}

	.status-context-pending {
		border-left-color: var(--color-warning, #d97706);
		background: var(--color-warning-bg, #fef3c7);
		color: var(--color-warning, #92400e);
	}

	.status-context-adopted {
		border-left-color: var(--color-success);
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success);
	}

	.status-context-rejected {
		border-left-color: var(--color-danger);
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger);
	}

	.status-context-withdrawn {
		border-left-color: var(--color-text-muted);
	}

	/* Contextual explanations in sections */
	.section-context {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0 0 1rem 0;
		font-style: italic;
	}

	.empty-state-contextual {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.law-type-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: var(--color-primary-bg);
		color: var(--color-primary);
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	/* Timeline */
	.timeline-card {
		margin-top: 1.5rem;
	}

	.timeline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem 0;
	}

	.timeline-event {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.timeline-marker {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-border);
		flex-shrink: 0;
	}

	.timeline-event[data-type='deposit'] .timeline-marker {
		background: var(--color-text-muted);
	}

	.timeline-event[data-type='adoption'] .timeline-marker {
		background: var(--color-primary);
	}

	.timeline-event[data-type='promulgation'] .timeline-marker {
		background: var(--color-success);
	}

	.timeline-event[data-type='publication'] .timeline-marker {
		background: var(--color-success);
	}

	.timeline-content {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.timeline-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	.timeline-label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.timeline-connector {
		width: 24px;
		height: 2px;
		background: var(--color-border);
		margin: 0 0.25rem;
	}

	/* Category breakdown */
	.category-breakdown {
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.category-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.category-chip {
		padding: 0.25rem 0.5rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}

	/* Scrutins list */
	.scrutins-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.scrutin-item {
		display: block;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		text-decoration: none;
		color: var(--color-text);
		transition: all 0.2s;
	}

	.scrutin-item:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-primary);
	}

	.scrutin-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.scrutin-number {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.scrutin-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.scrutin-result {
		margin-left: auto;
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.scrutin-result.adopted {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.scrutin-result.rejected {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.scrutin-title {
		font-weight: 500;
		margin-bottom: 0.5rem;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.scrutin-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.75rem;
	}

	.scrutin-category {
		padding: 0.125rem 0.5rem;
		background: var(--color-primary-bg);
		color: var(--color-primary);
		border-radius: var(--radius-sm);
	}

	.scrutin-votes {
		display: flex;
		gap: 0.75rem;
		color: var(--color-text-muted);
	}

	.vote-for {
		color: var(--color-success);
	}

	.vote-against {
		color: var(--color-danger);
	}

	.vote-abstention {
		color: var(--color-text-muted);
	}

	/* Info list */
	.info-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

	.law-description {
		white-space: pre-wrap;
		line-height: 1.6;
		max-height: 400px;
		overflow-y: auto;
		padding: 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
	}

	.status-badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		background: var(--color-bg-secondary);
	}

	.status-adopted {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.status-rejected {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.status-pending {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}

	.external-link {
		color: var(--color-primary);
		text-decoration: none;
	}

	.external-link:hover {
		text-decoration: underline;
	}

	/* Contributors */
	.contributors-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-top: 1rem;
	}

	.contributor-group-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0 0 0.75rem 0;
	}

	.contributor-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.contributor-item {
		padding: 0.375rem 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		text-decoration: none;
		color: var(--color-text);
		transition: background 0.2s;
	}

	.contributor-item:hover {
		background: var(--color-bg-tertiary);
	}

	@media (max-width: 640px) {
		.timeline {
			flex-direction: column;
		}

		.timeline-connector {
			display: none;
		}
	}
</style>
