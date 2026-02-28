<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();

	let newTerm = $state('');
	let newExpansion = $state('');
</script>

<svelte:head>
	<title>Synonymes de recherche — Admin NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Synonymes de recherche</h1>
	<p class="page-subtitle">
		Mappages entre termes courants (acronymes, noms usuels) et leur forme dans les textes
		parlementaires officiels. Utilisés automatiquement lors de la recherche.
	</p>
</div>

<section class="card" style="margin-bottom: 2rem;">
	<h2>Ajouter / modifier un synonyme</h2>
	<form method="POST" action="?/add" use:enhance class="add-form">
		<div class="form-row">
			<label class="form-label">
				Terme (acronyme)
				<input
					type="text"
					name="term"
					class="input"
					placeholder="ex: SMIC"
					bind:value={newTerm}
					required
				/>
			</label>
			<label class="form-label" style="flex: 2">
				Expansion (forme dans les textes officiels)
				<input
					type="text"
					name="expansion"
					class="input"
					placeholder="ex: salaire minimum interprofessionnel de croissance"
					bind:value={newExpansion}
					required
				/>
			</label>
			<button type="submit" class="btn btn-primary" style="align-self: flex-end">
				Enregistrer
			</button>
		</div>
	</form>
</section>

<section class="card">
	<h2>Synonymes configurés ({data.synonyms.length})</h2>
	{#if data.synonyms.length === 0}
		<p class="empty">Aucun synonyme configuré.</p>
	{:else}
		<table class="synonyms-table">
			<thead>
				<tr>
					<th>Terme</th>
					<th>Expansion</th>
					<th>Modifié</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.synonyms as synonym}
					<tr>
						<td class="term-cell">{synonym.term}</td>
						<td class="expansion-cell">{synonym.expansion}</td>
						<td class="date-cell">
							{new Date(synonym.updatedAt).toLocaleDateString('fr-FR')}
						</td>
						<td class="action-cell">
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="term" value={synonym.term} />
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

	.synonyms-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
		font-size: 0.875rem;
	}

	.synonyms-table th {
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 2px solid var(--color-border);
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.synonyms-table tr:not(:last-child) td {
		border-bottom: 1px solid var(--color-border);
	}

	.synonyms-table td {
		padding: 0.625rem 0.75rem;
		vertical-align: middle;
	}

	.term-cell {
		font-family: monospace;
		font-weight: 600;
		white-space: nowrap;
	}

	.expansion-cell {
		color: var(--color-text-muted);
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
