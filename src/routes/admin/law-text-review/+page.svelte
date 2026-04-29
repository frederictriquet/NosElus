<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const REASON_LABELS: Record<string, string> = {
		low_score: 'Score faible',
		not_found: 'Non trouvé',
		text_too_short: 'Texte trop court'
	};

	const TYPE_LABELS: Record<string, string> = {
		PJL: 'Projet de loi',
		PPL: 'Proposition de loi',
		PJO: "Projet d'ordonnance"
	};

	// État recherche
	let expandedEntry = $state<string | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<
		Array<{ id: string; titre: string; score: number; num?: string; etat?: string }>
	>([]);
	let searchLoading = $state(false);

	// État aperçu (recherche)
	let previewTextId = $state<string | null>(null);
	let previewContent = $state<{ title: string; preview: string; totalLength: number } | null>(null);
	let previewLoading = $state(false);

	// État aperçu candidat
	let candidatePreviewId = $state<string | null>(null);
	let candidatePreviewContent = $state<{
		title: string;
		preview: string;
		totalLength: number;
	} | null>(null);
	let candidatePreviewLoading = $state(false);

	// État feedback
	let actionMessage = $state('');

	function toggleSearch(lawId: string) {
		if (expandedEntry === lawId) {
			expandedEntry = null;
			searchResults = [];
			searchQuery = '';
			previewTextId = null;
			previewContent = null;
		} else {
			expandedEntry = lawId;
			searchResults = [];
			searchQuery = '';
			previewTextId = null;
			previewContent = null;
		}
	}

	async function doSearch(lawTitle: string) {
		if (!searchQuery.trim()) return;
		searchLoading = true;
		searchResults = [];
		previewTextId = null;
		previewContent = null;

		try {
			const params = new URLSearchParams({
				action: 'search',
				q: searchQuery.trim(),
				lawTitle
			});
			const res = await fetch(`/api/admin/legifrance?${params}`);
			if (!res.ok) throw new Error(await res.text());
			const json = await res.json();
			searchResults = json.results;
		} catch (err) {
			console.error('Erreur recherche:', err);
			searchResults = [];
		} finally {
			searchLoading = false;
		}
	}

	async function loadPreview(textId: string) {
		if (previewTextId === textId) {
			previewTextId = null;
			previewContent = null;
			return;
		}
		previewLoading = true;
		previewTextId = textId;
		previewContent = null;

		try {
			const params = new URLSearchParams({ action: 'preview', textId });
			const res = await fetch(`/api/admin/legifrance?${params}`);
			if (!res.ok) throw new Error(await res.text());
			previewContent = await res.json();
		} catch (err) {
			console.error('Erreur aperçu:', err);
			previewContent = null;
		} finally {
			previewLoading = false;
		}
	}

	async function loadCandidatePreview(textId: string) {
		if (candidatePreviewId === textId) {
			candidatePreviewId = null;
			candidatePreviewContent = null;
			return;
		}
		candidatePreviewLoading = true;
		candidatePreviewId = textId;
		candidatePreviewContent = null;

		try {
			const params = new URLSearchParams({ action: 'preview', textId });
			const res = await fetch(`/api/admin/legifrance?${params}`);
			if (!res.ok) throw new Error(await res.text());
			candidatePreviewContent = await res.json();
		} catch (err) {
			console.error('Erreur aperçu candidat:', err);
			candidatePreviewContent = null;
		} finally {
			candidatePreviewLoading = false;
		}
	}

	function navigateFilter(reason: string) {
		const params = new URLSearchParams();
		if (reason) params.set('reason', reason);
		goto(`/admin/law-text-review${params.toString() ? '?' + params : ''}`);
	}

	function navigatePage(page: number) {
		const params = new URLSearchParams();
		if (data.reasonFilter) params.set('reason', data.reasonFilter);
		params.set('page', String(page));
		goto(`/admin/law-text-review?${params}`);
	}

	function handleFormResult() {
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			if (result.type === 'success') {
				const action = (result.data as { action?: string })?.action;
				if (action === 'approve' || action === 'associate') {
					actionMessage = 'Texte associé avec succès';
				} else if (action === 'dismiss') {
					actionMessage = 'Entrée ignorée';
				}
				expandedEntry = null;
				setTimeout(() => (actionMessage = ''), 3000);
			}
			await update();
		};
	}

	function formatDate(d: string | Date | null): string {
		if (!d) return '—';
		const date = typeof d === 'string' ? new Date(d) : d;
		return date.toLocaleDateString('fr-FR');
	}
</script>

<svelte:head>
	<title>Revue textes de loi - Admin - NosElus</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Revue des textes de loi</h1>
		<p class="subtitle">
			Entrées de la skip list Légifrance — approuver, rechercher manuellement ou ignorer
		</p>
	</header>

	{#if actionMessage}
		<div class="success-banner">{actionMessage}</div>
	{/if}

	<!-- Filtres -->
	<div class="filters" role="toolbar" aria-label="Filtrer par raison">
		<button class="filter-btn" class:active={!data.reasonFilter} onclick={() => navigateFilter('')}>
			Tous ({data.totalCount})
		</button>
		{#each Object.entries(REASON_LABELS) as [key, label]}
			<button
				class="filter-btn"
				class:active={data.reasonFilter === key}
				onclick={() => navigateFilter(key)}
			>
				{label} ({data.counts[key] || 0})
			</button>
		{/each}
	</div>

	<!-- Entrées -->
	{#if data.entries.length === 0}
		<p class="empty">Aucune entrée dans la skip list pour ce filtre.</p>
	{:else}
		<div class="entries">
			{#each data.entries as entry}
				<article class="entry-card">
					<!-- En-tête : raison + score + actions -->
					<div class="entry-header">
						<div class="entry-header-left">
							<span class="reason-badge reason-{entry.reason}">
								{REASON_LABELS[entry.reason] || entry.reason}
							</span>
							{#if entry.bestScore != null}
								<span class="score-badge">Score : {entry.bestScore.toFixed(3)}</span>
							{/if}
							<span class="date-badge">
								{formatDate(entry.attemptedAt)}
							</span>
						</div>
						<div class="action-buttons">
							{#if entry.bestMatchTextId && data.pisteConfigured}
								<form method="POST" action="?/approve" use:enhance={handleFormResult}>
									<input type="hidden" name="lawId" value={entry.lawId} />
									<input type="hidden" name="textId" value={entry.bestMatchTextId} />
									<button
										type="submit"
										class="btn-action btn-approve"
										title="Approuver le candidat"
									>
										Approuver
									</button>
								</form>
							{/if}
							{#if data.pisteConfigured}
								<button
									class="btn-action btn-search"
									title="Rechercher manuellement"
									onclick={() => toggleSearch(entry.lawId)}
								>
									Rechercher
								</button>
							{/if}
							<form method="POST" action="?/dismiss" use:enhance={handleFormResult}>
								<input type="hidden" name="lawId" value={entry.lawId} />
								<button type="submit" class="btn-action btn-dismiss" title="Ignorer">
									Ignorer
								</button>
							</form>
						</div>
					</div>

					<!-- Corps : deux colonnes loi / candidat -->
					<div class="entry-body">
						<!-- Colonne loi NosElus -->
						<div class="entry-col">
							<h3 class="col-label">Dossier législatif NosElus</h3>
							<div class="law-info">
								<p class="law-title">{entry.lawTitle}</p>
								<dl class="meta-grid">
									<dt>ID</dt>
									<dd><code>{entry.lawId}</code></dd>

									{#if entry.lawNumber}
										<dt>Numéro</dt>
										<dd>{entry.lawNumber}</dd>
									{/if}

									<dt>Type</dt>
									<dd>{TYPE_LABELS[entry.lawType] || entry.lawType}</dd>

									<dt>Statut</dt>
									<dd>{entry.lawStatus || '—'}</dd>

									<dt>Législature</dt>
									<dd>{entry.lawLegislature}</dd>

									{#if entry.lawInitiator}
										<dt>Initiateur</dt>
										<dd>{entry.lawInitiator}</dd>
									{/if}

									{#if entry.lawTheme}
										<dt>Thème</dt>
										<dd>{entry.lawTheme}</dd>
									{/if}

									{#if entry.lawDepositDate}
										<dt>Dépôt</dt>
										<dd>{formatDate(entry.lawDepositDate)}</dd>
									{/if}

									{#if entry.lawPromulgationDate}
										<dt>Promulgation</dt>
										<dd>{formatDate(entry.lawPromulgationDate)}</dd>
									{/if}

									{#if entry.lawSourceUrl}
										<dt>Source</dt>
										<dd>
											<a href={entry.lawSourceUrl} target="_blank" rel="noopener noreferrer">
												Voir le dossier
											</a>
										</dd>
									{/if}
								</dl>
							</div>
						</div>

						<!-- Colonne candidat Légifrance -->
						<div class="entry-col">
							<h3 class="col-label">Candidat Légifrance</h3>
							{#if entry.bestMatchTitle}
								<div class="candidate-info">
									<p class="candidate-title">{entry.bestMatchTitle}</p>
									{#if entry.bestMatchTextId}
										<dl class="meta-grid">
											<dt>TextId</dt>
											<dd><code>{entry.bestMatchTextId}</code></dd>
											{#if entry.threshold != null}
												<dt>Seuil utilisé</dt>
												<dd>{entry.threshold}</dd>
											{/if}
										</dl>
										{#if data.pisteConfigured}
											<button
												class="btn-action btn-preview"
												onclick={() => loadCandidatePreview(entry.bestMatchTextId!)}
											>
												{candidatePreviewId === entry.bestMatchTextId
													? 'Masquer le texte'
													: 'Voir le texte'}
											</button>
											{#if candidatePreviewId === entry.bestMatchTextId}
												<div class="preview-box">
													{#if candidatePreviewLoading}
														<p class="preview-loading">Chargement...</p>
													{:else if candidatePreviewContent}
														<p class="preview-title">
															{candidatePreviewContent.title}
														</p>
														<p class="preview-text">
															{candidatePreviewContent.preview}
														</p>
														<p class="preview-meta">
															{candidatePreviewContent.totalLength.toLocaleString('fr-FR')}
															caractères au total
														</p>
													{/if}
												</div>
											{/if}
										{/if}
									{/if}
								</div>
							{:else}
								<p class="no-candidate">Aucun candidat identifié</p>
							{/if}
						</div>
					</div>

					<!-- Panneau de recherche expandable -->
					{#if expandedEntry === entry.lawId}
						<div class="search-panel">
							<h3 class="col-label">Recherche manuelle sur Légifrance</h3>
							<div class="search-bar">
								<input
									type="text"
									placeholder="Rechercher sur Légifrance..."
									bind:value={searchQuery}
									onkeydown={(e) => {
										if (e.key === 'Enter') doSearch(entry.lawTitle);
									}}
								/>
								<button
									class="btn-action btn-search"
									onclick={() => doSearch(entry.lawTitle)}
									disabled={searchLoading || !searchQuery.trim()}
								>
									{searchLoading ? 'Recherche...' : 'Chercher'}
								</button>
							</div>

							{#if searchResults.length > 0}
								<div class="search-results">
									{#each searchResults as result}
										<div class="search-result">
											<div class="result-header">
												<span class="result-title">{result.titre}</span>
												<span class="result-score">Score : {result.score.toFixed(3)}</span>
											</div>
											<div class="result-actions">
												<button
													class="btn-action btn-preview"
													onclick={() => loadPreview(result.id)}
												>
													{previewTextId === result.id ? 'Masquer' : 'Aperçu'}
												</button>
												<form method="POST" action="?/associate" use:enhance={handleFormResult}>
													<input type="hidden" name="lawId" value={entry.lawId} />
													<input type="hidden" name="textId" value={result.id} />
													<button type="submit" class="btn-action btn-approve"> Associer </button>
												</form>
											</div>
											{#if previewTextId === result.id}
												<div class="preview-box">
													{#if previewLoading}
														<p class="preview-loading">Chargement de l'aperçu...</p>
													{:else if previewContent}
														<p class="preview-title">
															{previewContent.title}
														</p>
														<p class="preview-text">
															{previewContent.preview}
														</p>
														<p class="preview-meta">
															{previewContent.totalLength.toLocaleString('fr-FR')}
															caractères au total
														</p>
													{/if}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else if searchLoading}
								<p class="search-loading">Recherche en cours...</p>
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<nav class="pagination" aria-label="Pagination">
				<button
					class="page-btn"
					disabled={data.page <= 1}
					onclick={() => navigatePage(data.page - 1)}
				>
					Précédent
				</button>
				{#each Array.from({ length: data.totalPages }, (_, i) => i + 1) as p}
					<button class="page-btn" class:active={p === data.page} onclick={() => navigatePage(p)}>
						{p}
					</button>
				{/each}
				<button
					class="page-btn"
					disabled={data.page >= data.totalPages}
					onclick={() => navigatePage(data.page + 1)}
				>
					Suivant
				</button>
			</nav>
		{/if}
	{/if}
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	header {
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 1.75rem;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
	}

	.success-banner {
		background: var(--color-success-bg);
		border: 1px solid var(--color-success);
		color: var(--color-success);
		padding: 0.75rem 1rem;
		border-radius: var(--radius, 6px);
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	/* Filtres */
	.filters {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.filter-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.filter-btn:hover {
		background: var(--color-surface);
	}

	.filter-btn.active {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	/* Cartes d'entrées */
	.entries {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.entry-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.entry-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		flex-wrap: wrap;
	}

	.entry-header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	/* Badges */
	.reason-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.reason-low_score {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}

	.reason-not_found {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.reason-text_too_short {
		background: var(--color-primary-bg);
		color: var(--color-primary);
	}

	.score-badge {
		font-size: 0.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
	}

	.date-badge {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	/* Corps deux colonnes */
	.entry-body {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
	}

	.entry-col {
		padding: 1rem;
	}

	.entry-col:first-child {
		border-right: 1px solid var(--color-border);
	}

	.col-label {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		font-weight: 600;
		margin: 0 0 0.75rem 0;
	}

	/* Infos loi */
	.law-title {
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.4;
		margin: 0 0 0.75rem 0;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.75rem;
		font-size: 0.8125rem;
		margin: 0;
	}

	.meta-grid dt {
		color: var(--color-text-muted);
		font-weight: 500;
		white-space: nowrap;
	}

	.meta-grid dd {
		margin: 0;
		overflow-wrap: break-word;
	}

	.meta-grid code {
		font-size: 0.75rem;
		background: var(--color-bg);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	.meta-grid a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.meta-grid a:hover {
		text-decoration: underline;
	}

	/* Candidat */
	.candidate-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.candidate-title {
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.4;
	}

	.no-candidate {
		color: var(--color-text-muted);
		font-style: italic;
		font-size: 0.8125rem;
	}

	/* Boutons d'action */
	.action-buttons {
		display: flex;
		gap: 0.375rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.btn-action {
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		background: var(--color-bg);
		color: var(--color-text);
		white-space: nowrap;
	}

	.btn-action:hover:not(:disabled) {
		border-color: var(--color-text-muted);
	}

	.btn-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-approve {
		background: var(--color-success-bg);
		color: var(--color-success);
		border-color: var(--color-success);
	}

	.btn-approve:hover:not(:disabled) {
		background: var(--color-success);
		color: var(--color-surface);
	}

	.btn-search {
		background: var(--color-primary-bg);
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.btn-search:hover:not(:disabled) {
		background: var(--color-primary);
		color: var(--color-surface);
	}

	.btn-dismiss {
		background: var(--color-danger-bg);
		color: var(--color-danger);
		border-color: var(--color-danger);
	}

	.btn-dismiss:hover:not(:disabled) {
		background: var(--color-danger);
		color: var(--color-surface);
	}

	.btn-preview {
		background: var(--color-bg);
		color: var(--color-text-muted);
		border-color: var(--color-border);
	}

	.btn-preview:hover:not(:disabled) {
		background: var(--color-surface);
		border-color: var(--color-text-muted);
	}

	/* Panneau de recherche */
	.search-panel {
		padding: 1rem;
		background: var(--color-primary-bg);
		border-top: 1px solid var(--color-primary);
	}

	.search-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.search-bar input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-size: 0.875rem;
		background: var(--color-surface);
		color: var(--color-text);
	}

	.search-bar input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	.search-results {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.search-result {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 0.75rem;
	}

	.result-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.result-title {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.result-score {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.result-actions {
		display: flex;
		gap: 0.375rem;
	}

	.search-loading {
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		padding: 1rem;
	}

	/* Aperçu */
	.preview-box {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: var(--color-bg);
		border-radius: 4px;
		border: 1px solid var(--color-border);
	}

	.preview-loading {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		font-style: italic;
	}

	.preview-title {
		font-weight: 500;
		font-size: 0.8125rem;
		margin-bottom: 0.5rem;
	}

	.preview-text {
		font-size: 0.8125rem;
		line-height: 1.5;
		white-space: pre-wrap;
		color: var(--color-text-muted);
	}

	.preview-meta {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	/* Pagination */
	.pagination {
		display: flex;
		justify-content: center;
		gap: 0.25rem;
		margin-top: 1.5rem;
	}

	.page-btn {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s;
	}

	.page-btn:hover:not(:disabled) {
		background: var(--color-bg);
		border-color: var(--color-text-muted);
	}

	.page-btn.active {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.page-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.empty {
		padding: 3rem;
		text-align: center;
		color: var(--color-text-muted);
		font-style: italic;
		background: var(--color-surface);
		border-radius: 8px;
	}

	@media (max-width: 768px) {
		.entry-body {
			grid-template-columns: 1fr;
		}

		.entry-col:first-child {
			border-right: none;
			border-bottom: 1px solid var(--color-border);
		}

		.entry-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.action-buttons {
			width: 100%;
		}

		.result-header {
			flex-direction: column;
			gap: 0.25rem;
		}
	}
</style>
