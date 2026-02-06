<script lang="ts">
	/**
	 * Modal affichant le détail des accords/désaccords vote par vote
	 * entre l'utilisateur et un groupe parlementaire.
	 */
	import type { AlignmentResult } from '$lib/utils/alignment';

	interface Props {
		result: AlignmentResult;
		onClose: () => void;
	}

	let { result, onClose }: Props = $props();

	// Séparer accords et désaccords
	const agreements = $derived(result.details.filter((d) => d.agreement));
	const disagreements = $derived(result.details.filter((d) => !d.agreement));

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onClose}>
	<div
		class="modal-content"
		role="dialog"
		aria-modal="true"
		aria-label="Détail de l'alignement avec {result.groupName}"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="modal-header">
			<h2>Détail de l'alignement</h2>
			<button class="close-btn" onclick={onClose} type="button">
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
					<line x1="18" x2="6" y1="6" y2="18" />
					<line x1="6" x2="18" y1="6" y2="18" />
				</svg>
			</button>
		</div>

		<div class="modal-body">
			<div class="group-summary">
				<h3>{result.groupName}</h3>
				<div class="stats">
					<span class="stat-item agreement">{result.agreements} accords</span>
					<span class="stat-item disagreement">{result.disagreements} désaccords</span>
					<span class="stat-item score">{result.score}% d'alignement</span>
				</div>
			</div>

			{#if agreements.length > 0}
				<section class="vote-section">
					<h4 class="section-title agreement">
						✓ Accords ({agreements.length})
					</h4>
					<ul class="vote-list">
						{#each agreements as detail}
							<li class="vote-item agreement">
								<div class="law-title">
									<a href="/an/laws/{detail.lawId}" target="_blank" rel="noopener noreferrer" class="source-link" title="Voir le dossier législatif">
										{detail.lawTitle}
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
									</a>
								</div>
								<div class="positions">
									<span class="position user">Vous : {detail.userPosition}</span>
									<span class="position group">{result.groupShortName} : {detail.groupPosition}</span>
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if disagreements.length > 0}
				<section class="vote-section">
					<h4 class="section-title disagreement">
						✗ Désaccords ({disagreements.length})
					</h4>
					<ul class="vote-list">
						{#each disagreements as detail}
							<li class="vote-item disagreement">
								<div class="law-title">
									<a href="/an/laws/{detail.lawId}" target="_blank" rel="noopener noreferrer" class="source-link" title="Voir le dossier législatif">
										{detail.lawTitle}
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
									</a>
								</div>
								<div class="positions">
									<span class="position user">Vous : {detail.userPosition}</span>
									<span class="position group">{result.groupShortName} : {detail.groupPosition}</span>
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		max-width: 600px;
		width: 100%;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		color: var(--color-text-muted);
		transition: color 0.2s;
	}

	.close-btn:hover {
		color: var(--color-text);
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
	}

	.group-summary {
		margin-bottom: 2rem;
		text-align: center;
	}

	.group-summary h3 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: var(--color-text);
	}

	.stats {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.stat-item {
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: 999px;
	}

	.stat-item.agreement {
		background: #10b98120;
		color: #10b981;
	}

	.stat-item.disagreement {
		background: #ef444420;
		color: #ef4444;
	}

	.stat-item.score {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.vote-section {
		margin-bottom: 2rem;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid;
	}

	.section-title.agreement {
		color: #10b981;
		border-color: #10b981;
	}

	.section-title.disagreement {
		color: #ef4444;
		border-color: #ef4444;
	}

	.vote-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.vote-item {
		padding: 1rem;
		border-radius: var(--radius);
		border-left: 3px solid;
	}

	.vote-item.agreement {
		background: #10b98110;
		border-color: #10b981;
	}

	.vote-item.disagreement {
		background: #ef444410;
		border-color: #ef4444;
	}

	.law-title {
		font-weight: 500;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text);
	}

	.source-link {
		color: var(--color-primary);
		text-decoration: none;
	}

	.source-link:hover {
		text-decoration: underline;
	}

	.source-link svg {
		display: inline;
		vertical-align: middle;
		margin-left: 0.25rem;
		opacity: 0.6;
	}

	.positions {
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
	}

	.position {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		background: var(--color-bg);
		color: var(--color-text-muted);
	}

	@media (max-width: 640px) {
		.modal-content {
			max-height: 90vh;
		}

		.modal-header {
			padding: 1rem;
		}

		.modal-header h2 {
			font-size: 1.25rem;
		}

		.modal-body {
			padding: 1rem;
		}

		.stats {
			gap: 0.75rem;
		}

		.stat-item {
			font-size: 0.75rem;
			padding: 0.375rem 0.75rem;
		}
	}
</style>
