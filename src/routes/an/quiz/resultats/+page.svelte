<script lang="ts">
	import { goto } from '$app/navigation';
	import AlignmentPodium from '$lib/components/AlignmentPodium.svelte';
	import VoteDetailModal from '$lib/components/VoteDetailModal.svelte';
	import { getPodium } from '$lib/utils/alignment';
	import type { AlignmentResult } from '$lib/utils/alignment';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedGroup = $state<AlignmentResult | null>(null);

	const podium = $derived(getPodium(data.results));
	const remainingGroups = $derived(data.results.slice(3));

	const handleRestart = () => {
		// Effacer localStorage et redémarrer
		if (typeof window !== 'undefined') {
			localStorage.removeItem('noselus-quiz-votes');
			localStorage.removeItem('noselus-quiz-session');
		}
		goto('/an/quiz');
	};

	const handleShowDetail = (group: AlignmentResult) => {
		selectedGroup = group;
	};

	const handleCloseModal = () => {
		selectedGroup = null;
	};
</script>

<svelte:head>
	<title>Vos Résultats - Quiz Politique - NosÉlus</title>
	<meta
		name="description"
		content="Découvrez votre alignement politique avec les groupes parlementaires"
	/>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Vos Résultats</h1>
	<p class="page-subtitle">
		Voici votre alignement avec les groupes parlementaires de l'Assemblée nationale
	</p>
</div>

<div class="results-container">
	{#if data.results.length === 0}
		<div class="card">
			<p class="error-message">
				Aucun résultat à afficher. <a href="/an/quiz">Recommencer le quiz</a>
			</p>
		</div>
	{:else}
		<!-- Podium Top 3 -->
		{#if podium.length >= 3}
			<section class="card podium-section">
				<h2>Votre Top 3</h2>
				<p class="section-subtitle">
					Les 3 groupes parlementaires avec lesquels vous êtes le plus aligné
				</p>
				<AlignmentPodium results={podium} />
			</section>
		{/if}

		<!-- Tableau complet des résultats -->
		<section class="card results-table-section">
			<h2>Alignement avec tous les groupes</h2>
			<p class="section-subtitle">Cliquez sur un groupe pour voir le détail des votes</p>

			<div class="results-table">
				<table>
					<thead>
						<tr>
							<th class="col-rank">Rang</th>
							<th class="col-group">Groupe</th>
							<th class="col-score">Score</th>
							<th class="col-details">Accords/Désaccords</th>
						</tr>
					</thead>
					<tbody>
						{#each data.results as result, index}
							<tr
								class="result-row"
								class:top-3={index < 3}
								onclick={() => handleShowDetail(result)}
								role="button"
								tabindex="0"
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleShowDetail(result);
									}
								}}
							>
								<td class="col-rank">
									<span class="rank">#{index + 1}</span>
								</td>
								<td class="col-group">
									<div class="group-info">
										<div class="group-name">{result.groupShortName}</div>
										<div class="group-full-name">{result.groupName}</div>
									</div>
								</td>
								<td class="col-score">
									<div class="score-container">
										<span class="score-value">{result.score}%</span>
										<div class="score-bar">
											<div class="score-fill" style="width: {result.score}%"></div>
										</div>
									</div>
								</td>
								<td class="col-details">
									<div class="details">
										<span class="agreements">✓ {result.agreements}</span>
										<span class="disagreements">✗ {result.disagreements}</span>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<!-- Actions -->
		<section class="actions-section">
			<button class="btn-primary restart-btn" onclick={handleRestart} type="button">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 2v6h-6" />
					<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
					<path d="M3 22v-6h6" />
					<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
				</svg>
				<span>Recommencer le quiz</span>
			</button>

			<div class="disclaimer">
				<p>
					ℹ️ <strong>Note</strong> : Ce quiz est indicatif et basé sur {data.userVotes.length} lois de
					la législature 17. L'alignement est calculé en comparant vos votes avec les votes majoritaires
					de chaque groupe parlementaire (algorithme de similarité de Jaccard).
				</p>
			</div>
		</section>
	{/if}
</div>

<!-- Modal détail -->
{#if selectedGroup}
	<VoteDetailModal result={selectedGroup} onClose={handleCloseModal} />
{/if}

<style>
	.results-container {
		max-width: 1000px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.podium-section {
		padding: 2rem;
	}

	.podium-section h2 {
		text-align: center;
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
	}

	.section-subtitle {
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0 0 2rem 0;
	}

	.results-table-section {
		padding: 2rem;
	}

	.results-table-section h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
	}

	.results-table {
		overflow-x: auto;
		margin-top: 1.5rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead th {
		background: var(--color-bg);
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		border-bottom: 2px solid var(--color-border);
	}

	.col-rank {
		width: 80px;
	}

	.col-score {
		width: 200px;
	}

	.col-details {
		width: 180px;
	}

	.result-row {
		cursor: pointer;
		transition: background 0.2s;
	}

	.result-row:hover {
		background: var(--color-bg);
	}

	.result-row.top-3 {
		background: var(--color-primary-light);
	}

	.result-row td {
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.rank {
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.group-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.group-name {
		font-weight: 600;
		color: var(--color-text);
	}

	.group-full-name {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.score-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.score-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.score-bar {
		height: 8px;
		background: var(--color-border);
		border-radius: 999px;
		overflow: hidden;
	}

	.score-fill {
		height: 100%;
		background: var(--color-primary);
		border-radius: 999px;
		transition: width 0.3s;
	}

	.details {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.agreements {
		color: #10b981;
	}

	.disagreements {
		color: #ef4444;
	}

	.actions-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		align-items: center;
	}

	.restart-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.75rem;
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
		background: var(--color-primary);
		border: none;
		color: white;
		font-size: 1rem;
		transition: all 0.2s;
	}

	.restart-btn:hover {
		background: var(--color-primary-dark);
		transform: translateY(-2px);
		box-shadow: var(--shadow);
	}

	.disclaimer {
		max-width: 700px;
		padding: 1.25rem;
		background: var(--color-bg);
		border-radius: var(--radius);
		border-left: 3px solid var(--color-primary);
	}

	.disclaimer p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-text);
	}

	.error-message {
		text-align: center;
		padding: 2rem;
	}

	.error-message a {
		color: var(--color-primary);
		text-decoration: underline;
	}

	@media (max-width: 768px) {
		.results-table {
			font-size: 0.875rem;
		}

		thead th,
		.result-row td {
			padding: 0.75rem 0.5rem;
		}

		.col-rank {
			width: 60px;
		}

		.col-score {
			width: 150px;
		}

		.col-details {
			width: 140px;
		}

		.score-value {
			font-size: 1.25rem;
		}

		.group-full-name {
			display: none;
		}

		.details {
			flex-direction: column;
			gap: 0.25rem;
		}

		.podium-section,
		.results-table-section {
			padding: 1rem;
		}
	}
</style>
