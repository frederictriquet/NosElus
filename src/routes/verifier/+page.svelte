<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let searchInput = $state(data.query || '');

	function handleSearch(e: Event) {
		e.preventDefault();
		if (searchInput.trim().length >= 2) {
			const params = new URLSearchParams();
			params.set('q', searchInput.trim());
			goto(`/verifier?${params.toString()}`);
		}
	}

	function getLegislatureLabel(legislature: string | null): string {
		if (!legislature) return '';
		if (legislature.startsWith('PE-')) return 'Parlement européen';
		return `${legislature}e législature`;
	}
</script>

<svelte:head>
	<title>Vérifier une affirmation{data.query ? ` — ${data.query}` : ''} — NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Vérifier une affirmation</h1>
	<p class="page-subtitle">
		Entrez une affirmation politique pour trouver les scrutins officiels qui la confirment ou
		l'infirment
	</p>
</div>

<div class="verifier-container">
	<form onsubmit={handleSearch} class="verifier-form">
		<div class="form-label">J'ai lu que…</div>
		<div class="form-row">
			<input
				type="text"
				class="input verifier-input"
				placeholder="ex : Le RN a voté contre l'augmentation du SMIC"
				bind:value={searchInput}
			/>
			<button type="submit" class="btn btn-primary">Vérifier</button>
		</div>
	</form>
</div>

{#if data.scrutins !== null}
	{#if data.scrutins.length > 0}
		<div class="results-header">
			<span class="results-count"
				>{data.scrutins.length} scrutin{data.scrutins.length > 1 ? 's' : ''} trouvé{data.scrutins
					.length > 1
					? 's'
					: ''}</span
			>
			pour « <strong>{data.query}</strong> »
			{#if data.matchedGroupShortName}
				<span class="group-badge">vote {data.matchedGroupShortName} inclus</span>
			{/if}
		</div>

		{#if data.verdict}
			<div
				class="verdict-banner"
				class:verdict-confirme={data.verdict.verdict === 'confirmé'}
				class:verdict-infirme={data.verdict.verdict === 'infirmé'}
				class:verdict-nuance={data.verdict.verdict === 'nuancé'}
			>
				<span class="verdict-icon">
					{#if data.verdict.verdict === 'confirmé'}✅{:else if data.verdict.verdict === 'infirmé'}❌{:else}🟡{/if}
				</span>
				<span class="verdict-label">
					{#if data.verdict.verdict === 'confirmé'}Confirmé{:else if data.verdict.verdict === 'infirmé'}Infirmé{:else}Nuancé{/if}
				</span>
				<span class="verdict-detail">
					sur {data.verdict.scrutinCount} scrutin{data.verdict.scrutinCount > 1 ? 's' : ''} —
					{data.verdict.confirmPct}% confirment
				</span>
			</div>
		{/if}

		<p class="disclaimer">
			Les résultats ci-dessous sont des votes officiels.
			{#if !data.verdict}L'interprétation reste à votre charge.{:else}Le verdict est calculé
				automatiquement — un vote ne résume pas la position complète d'un groupe.{/if}
		</p>

		<div class="scrutins-list">
			{#each data.scrutins as scrutin}
				<a href="/scrutins/{scrutin.id}" class="scrutin-card">
					<div class="scrutin-body">
						<div class="scrutin-title">{scrutin.title}</div>
						<div class="scrutin-meta">
							{#if scrutin.date}
								<span>{new Date(scrutin.date).toLocaleDateString('fr-FR')}</span>
							{/if}
							{#if scrutin.legislature}
								<span class="leg-badge">{getLegislatureLabel(scrutin.legislature)}</span>
							{/if}
						</div>
						{#if scrutin.groupVote}
							<div class="group-vote-row">
								<span class="group-name">{data.matchedGroupShortName} :</span>
								{#if scrutin.groupVote.pctPour >= scrutin.groupVote.pctContre && scrutin.groupVote.pctPour >= scrutin.groupVote.pctAbstention}
									<span class="vote-pour">✅ {scrutin.groupVote.pctPour}% pour</span>
								{:else if scrutin.groupVote.pctContre >= scrutin.groupVote.pctPour && scrutin.groupVote.pctContre >= scrutin.groupVote.pctAbstention}
									<span class="vote-contre">❌ {scrutin.groupVote.pctContre}% contre</span>
								{:else}
									<span class="vote-abstention"
										>🟡 {scrutin.groupVote.pctAbstention}% abstention</span
									>
								{/if}
							</div>
						{/if}
					</div>
					{#if scrutin.result}
						<span
							class="result-badge"
							class:adopte={scrutin.result === 'adopté'}
							class:rejete={scrutin.result === 'rejeté'}
						>
							{scrutin.result}
						</span>
					{/if}
				</a>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<p>Aucun scrutin trouvé pour « {data.query} »</p>
			<p class="empty-hint">
				Essayez avec d'autres mots-clés, par exemple : « SMIC », « retraites 2023 », « immigration
				».
			</p>
		</div>
	{/if}
{:else}
	<div class="empty-state">
		<p>Entrez une affirmation pour trouver les scrutins correspondants</p>
		<p class="empty-hint">
			Exemple : « Le RN a voté contre l'augmentation du SMIC » ou « retraites LFI 2023 »
		</p>
	</div>
{/if}

<style>
	.verifier-container {
		margin-bottom: 2rem;
	}

	.verifier-form {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		border: 1px solid var(--color-border);
	}

	.form-label {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.form-row {
		display: flex;
		gap: 1rem;
	}

	.verifier-input {
		flex: 1;
		font-size: 1rem;
		padding: 0.75rem 1rem;
	}

	.results-header {
		margin-bottom: 0.5rem;
		color: var(--color-text-muted);
	}

	.results-count {
		font-weight: 600;
		color: var(--color-text);
	}

	.group-badge {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.125rem 0.5rem;
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
		color: var(--color-primary);
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.verdict-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
		font-weight: 600;
	}

	.verdict-confirme {
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success, #166534);
		border: 1px solid var(--color-success, #166534);
	}

	.verdict-infirme {
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger, #991b1b);
		border: 1px solid var(--color-danger, #991b1b);
	}

	.verdict-nuance {
		background: var(--color-warning-bg, #fef9c3);
		color: var(--color-warning-text, #92400e);
		border: 1px solid var(--color-warning, #d97706);
	}

	.verdict-icon {
		font-size: 1.125rem;
		flex-shrink: 0;
	}

	.verdict-label {
		font-size: 0.9375rem;
		font-weight: 700;
	}

	.verdict-detail {
		font-size: 0.8125rem;
		font-weight: 400;
		opacity: 0.8;
	}

	.disclaimer {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		border-left: 1px solid var(--color-border);
		padding-left: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.scrutins-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.scrutin-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-surface);
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
		transition: box-shadow 0.2s;
	}

	.scrutin-card:hover {
		box-shadow: var(--shadow-md);
		text-decoration: none;
	}

	.scrutin-body {
		flex: 1;
		min-width: 0;
	}

	.scrutin-title {
		font-weight: 500;
		line-height: 1.4;
		margin-bottom: 0.25rem;
	}

	.scrutin-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-bottom: 0.375rem;
	}

	.leg-badge {
		padding: 0.125rem 0.375rem;
		background: var(--color-bg);
		border-radius: 4px;
	}

	.group-vote-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.group-name {
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.vote-pour {
		color: var(--color-success);
		font-weight: 600;
	}

	.vote-contre {
		color: var(--color-danger);
		font-weight: 600;
	}

	.vote-abstention {
		color: var(--color-warning, #92400e);
		font-weight: 600;
	}

	.result-badge {
		padding: 0.25rem 0.625rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		flex-shrink: 0;
	}

	.result-badge.adopte {
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success);
	}

	.result-badge.rejete {
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger);
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--color-text-muted);
	}

	.empty-hint {
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	@media (max-width: 640px) {
		.form-row {
			flex-direction: column;
		}
	}
</style>
