<script lang="ts">
	interface Distribution {
		pour: number;
		contre: number;
		abstention: number;
		'non-votant'?: number;
	}

	interface Props {
		distribution: Distribution;
	}

	let { distribution }: Props = $props();

	const totalExprimes = $derived(distribution.pour + distribution.contre + distribution.abstention);
	const nonVotants = $derived(distribution['non-votant'] ?? 0);
	const totalAvecAbsents = $derived(totalExprimes + nonVotants);
</script>

<section class="card">
	<h2>Répartition des votes</h2>
	{#if totalAvecAbsents > 0}
		<div class="vote-bar">
			<div class="vote-bar-for" style="width: {(distribution.pour / totalAvecAbsents) * 100}%"></div>
			<div class="vote-bar-against" style="width: {(distribution.contre / totalAvecAbsents) * 100}%"></div>
			<div class="vote-bar-abstention" style="width: {(distribution.abstention / totalAvecAbsents) * 100}%"></div>
			{#if nonVotants > 0}
				<div class="vote-bar-nonvotant" style="width: {(nonVotants / totalAvecAbsents) * 100}%"></div>
			{/if}
		</div>
		<div class="vote-details">
			<div>
				<div class="vote-count pour">{distribution.pour.toLocaleString('fr-FR')}</div>
				<div class="vote-label">Pour</div>
			</div>
			<div>
				<div class="vote-count contre">{distribution.contre.toLocaleString('fr-FR')}</div>
				<div class="vote-label">Contre</div>
			</div>
			<div>
				<div class="vote-count abstention">{distribution.abstention.toLocaleString('fr-FR')}</div>
				<div class="vote-label">Abstention</div>
			</div>
			{#if nonVotants > 0}
				<div>
					<div class="vote-count nonvotant">{nonVotants.toLocaleString('fr-FR')}</div>
					<div class="vote-label">Non-votants</div>
				</div>
			{/if}
		</div>
	{:else}
		<p class="empty-state">Aucun vote enregistré</p>
	{/if}
</section>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.vote-bar {
		display: flex;
		height: 24px;
		border-radius: 12px;
		overflow: hidden;
		margin-top: 1rem;
	}

	.vote-bar-for {
		background: var(--color-success);
	}

	.vote-bar-against {
		background: var(--color-danger);
	}

	.vote-bar-abstention {
		background: var(--color-warning);
	}

	.vote-bar-nonvotant {
		background: var(--color-text-muted);
	}

	.vote-details {
		display: flex;
		justify-content: space-around;
		margin-top: 1rem;
		text-align: center;
	}

	.vote-count {
		font-size: 1.25rem;
		font-weight: 700;
	}

	.vote-count.pour {
		color: var(--color-success);
	}

	.vote-count.contre {
		color: var(--color-danger);
	}

	.vote-count.abstention {
		color: var(--color-warning);
	}

	.vote-count.nonvotant {
		color: var(--color-text-muted);
	}

	.vote-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}
</style>
