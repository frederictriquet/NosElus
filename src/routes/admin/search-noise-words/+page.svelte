<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();

	let newWord = $state('');
</script>

<svelte:head>
	<title>Mots bruit recherche — Admin NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Mots bruit de recherche</h1>
	<p class="page-subtitle">
		Mots exclus de la recherche fulltext sur les scrutins. Les utilisateurs les incluent
		naturellement ("SMIC RN <strong>vote</strong>") mais ils n'apparaissent pas dans les titres
		parlementaires et bloquent les résultats.
	</p>
</div>

<section class="card" style="margin-bottom: 2rem;">
	<h2>Ajouter un mot bruit</h2>
	<form method="POST" action="?/add" use:enhance class="add-form">
		<div class="form-row">
			<label class="form-label">
				Mot à exclure
				<input
					type="text"
					name="word"
					class="input"
					placeholder="ex: voter"
					bind:value={newWord}
					required
				/>
			</label>
			<button type="submit" class="btn btn-primary" style="align-self: flex-end"> Ajouter </button>
		</div>
	</form>
</section>

<section class="card">
	<h2>Mots configurés ({data.words.length})</h2>
	{#if data.words.length === 0}
		<p class="empty">Aucun mot bruit configuré.</p>
	{:else}
		<table class="words-table">
			<thead>
				<tr>
					<th>Mot</th>
					<th>Ajouté</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.words as w}
					<tr>
						<td class="word-cell">{w.word}</td>
						<td class="date-cell">
							{new Date(w.createdAt).toLocaleDateString('fr-FR')}
						</td>
						<td class="action-cell">
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="word" value={w.word} />
								<button type="submit" class="btn-delete" title="Supprimer">✕</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.add-form {
		margin-top: 1rem;
	}

	.form-row {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.form-label {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		flex: 1;
	}

	.words-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
		font-size: 0.875rem;
	}

	.words-table th {
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 2px solid var(--color-border);
		color: var(--color-text-muted);
		font-weight: 600;
	}

	.words-table tr:not(:last-child) td {
		border-bottom: 1px solid var(--color-border);
	}

	.words-table td {
		padding: 0.625rem 0.75rem;
		vertical-align: middle;
	}

	.word-cell {
		font-family: monospace;
		font-weight: 600;
	}

	.date-cell {
		white-space: nowrap;
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.action-cell {
		width: 2rem;
		text-align: center;
	}

	.btn-delete {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-danger);
		font-size: 0.875rem;
		padding: 0.25rem;
		border-radius: 4px;
		line-height: 1;
	}

	.btn-delete:hover {
		background: var(--color-danger-bg, #fde2e2);
	}

	.empty {
		color: var(--color-text-muted);
		margin-top: 1rem;
	}

	@media (max-width: 640px) {
		.form-row {
			flex-direction: column;
		}
	}
</style>
