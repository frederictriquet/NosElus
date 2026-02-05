<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ElectedCard from '$lib/components/ElectedCard.svelte';

	let { data } = $props();

	let mep1 = $state($page.url.searchParams.get('m1') || '');
	let mep2 = $state($page.url.searchParams.get('m2') || '');

	function compare() {
		if (mep1 && mep2 && mep1 !== mep2) {
			const params = new URLSearchParams();
			params.set('m1', mep1);
			params.set('m2', mep2);
			goto(`/pe/eurodeputes/compare?${params.toString()}`);
		}
	}

	function getPositionClass(position: string) {
		if (position === 'pour') return 'pour';
		if (position === 'contre') return 'contre';
		if (position === 'abstention') return 'abstention';
		return '';
	}

	function getPercent(
		value: number,
		dist: { pour: number; contre: number; abstention: number; 'non-votant'?: number }
	) {
		const total = dist.pour + dist.contre + dist.abstention + (dist['non-votant'] || 0) || 1;
		return ((value / total) * 100).toFixed(0);
	}
</script>

<svelte:head>
	<title>Comparateur d'eurodéputés - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Comparateur d'eurodéputés</h1>
	<p class="page-subtitle">Comparez les votes de deux eurodéputés français au Parlement européen</p>
</div>

<div class="card" style="margin-bottom: 2rem;">
	<div class="compare-selectors">
		<div class="selector">
			<label for="mep1">Premier eurodéputé</label>
			<select id="mep1" class="input" bind:value={mep1}>
				<option value="">Sélectionner un eurodéputé</option>
				{#each data.meps as m}
					<option value={m.id}>{m.name}</option>
				{/each}
			</select>
		</div>
		<div class="vs">VS</div>
		<div class="selector">
			<label for="mep2">Second eurodéputé</label>
			<select id="mep2" class="input" bind:value={mep2}>
				<option value="">Sélectionner un eurodéputé</option>
				{#each data.meps as m}
					<option value={m.id}>{m.name}</option>
				{/each}
			</select>
		</div>
	</div>
	<div style="text-align: center; margin-top: 1.5rem;">
		<button class="btn btn-primary" onclick={compare} disabled={!mep1 || !mep2 || mep1 === mep2}>
			Comparer
		</button>
	</div>
</div>

{#if data.comparison}
	{#await data.comparison}
		<div class="loading-state">
			<div class="metrics-row">
				<div class="agreement-card loading">
					<div class="skeleton-value"></div>
					<div class="skeleton-label"></div>
				</div>
				<div class="agreement-card loading">
					<div class="skeleton-value"></div>
					<div class="skeleton-label"></div>
				</div>
			</div>
		</div>
	{:then comparison}
		{#if comparison}
			{#if comparison.commonVotes === 0}
				<div class="empty-state">
					<p>Aucun vote en commun trouvé</p>
					<p class="coming-soon">
						Importez les votes PE avec <code>make etl-europarl-votes</code>
					</p>
				</div>
			{:else}
				<div class="metrics-row">
					<div class="agreement-card">
						<div
							class="agreement-value"
							class:high={comparison.agreementRate >= 70}
							class:medium={comparison.agreementRate >= 40 && comparison.agreementRate < 70}
							class:low={comparison.agreementRate < 40}
						>
							{comparison.agreementRate.toFixed(1)}%
						</div>
						<div class="agreement-label">de votes identiques</div>
						<div class="agreement-detail">
							sur {comparison.commonVotes} votes en commun
						</div>
					</div>
					<div class="agreement-card distance-card">
						<div
							class="distance-value"
							class:close={comparison.politicalDistance < 20}
							class:moderate={comparison.politicalDistance >= 20 &&
								comparison.politicalDistance < 50}
							class:far={comparison.politicalDistance >= 50}
						>
							{comparison.politicalDistance.toFixed(1)}
						</div>
						<div class="agreement-label">distance politique</div>
						<div class="agreement-detail">
							{#if comparison.politicalDistance < 20}
								Très proches
							{:else if comparison.politicalDistance < 35}
								Proches
							{:else if comparison.politicalDistance < 50}
								Modérément éloignés
							{:else if comparison.politicalDistance < 70}
								Éloignés
							{:else}
								Très éloignés
							{/if}
						</div>
					</div>
				</div>

				<div class="comparison-grid">
					<div class="comparison-deputy">
						<ElectedCard
							id={comparison.mep1.id}
							name={comparison.mep1.fullName}
							photoUrl={comparison.mep1.photoUrl}
							group={comparison.mep1.group}
							subtitle="{comparison.mep1.voteCount} votes"
							type="eurodepute"
						>
							{#snippet children()}
								<div class="comparison-dist">
									<div class="dist-item pour">
										{getPercent(comparison.mep1.distribution.pour, comparison.mep1.distribution)}%
										pour
									</div>
									<div class="dist-item contre">
										{getPercent(comparison.mep1.distribution.contre, comparison.mep1.distribution)}%
										contre
									</div>
									<div class="dist-item abstention">
										{getPercent(
											comparison.mep1.distribution.abstention,
											comparison.mep1.distribution
										)}% abs.
									</div>
									{#if comparison.mep1.distribution['non-votant'] > 0}
										<div class="dist-item nonvotant">
											{getPercent(
												comparison.mep1.distribution['non-votant'],
												comparison.mep1.distribution
											)}% n.v.
										</div>
									{/if}
								</div>
							{/snippet}
						</ElectedCard>
					</div>

					<div class="comparison-stats">
						<div class="stat-row">
							<span class="stat-label">Votes identiques</span>
							<span class="stat-value success">{comparison.sameVotes}</span>
						</div>
						<div class="stat-row">
							<span class="stat-label">Votes différents</span>
							<span class="stat-value danger">{comparison.differentVotes}</span>
						</div>
					</div>

					<div class="comparison-deputy">
						<ElectedCard
							id={comparison.mep2.id}
							name={comparison.mep2.fullName}
							photoUrl={comparison.mep2.photoUrl}
							group={comparison.mep2.group}
							subtitle="{comparison.mep2.voteCount} votes"
							type="eurodepute"
						>
							{#snippet children()}
								<div class="comparison-dist">
									<div class="dist-item pour">
										{getPercent(comparison.mep2.distribution.pour, comparison.mep2.distribution)}%
										pour
									</div>
									<div class="dist-item contre">
										{getPercent(comparison.mep2.distribution.contre, comparison.mep2.distribution)}%
										contre
									</div>
									<div class="dist-item abstention">
										{getPercent(
											comparison.mep2.distribution.abstention,
											comparison.mep2.distribution
										)}% abs.
									</div>
									{#if comparison.mep2.distribution['non-votant'] > 0}
										<div class="dist-item nonvotant">
											{getPercent(
												comparison.mep2.distribution['non-votant'],
												comparison.mep2.distribution
											)}% n.v.
										</div>
									{/if}
								</div>
							{/snippet}
						</ElectedCard>
					</div>
				</div>

				{#if comparison.disagreements.length > 0}
					<section class="card" style="margin-top: 2rem;">
						<h2>Votes divergents récents</h2>
						<div class="disagreements-list">
							{#each comparison.disagreements as d}
								<div class="disagreement-item">
									<div class="disagreement-votes">
										<span class="vote-badge {getPositionClass(d.position1)}">{d.position1}</span>
										<span class="vote-separator">≠</span>
										<span class="vote-badge {getPositionClass(d.position2)}">{d.position2}</span>
									</div>
									<div class="disagreement-info">
										<div class="disagreement-title">
											{d.scrutinTitle?.slice(0, 100)}{(d.scrutinTitle?.length || 0) > 100
												? '...'
												: ''}
										</div>
										<div class="disagreement-date">
											{new Date(d.scrutinDate).toLocaleDateString('fr-FR')}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		{:else}
			<div class="empty-state error">
				<p>Eurodéputé non trouvé</p>
			</div>
		{/if}
	{:catch}
		<div class="empty-state error">
			<p>Erreur lors du chargement de la comparaison</p>
		</div>
	{/await}
{:else if !mep1 || !mep2}
	<div class="empty-state">
		<p>Sélectionnez deux eurodéputés pour les comparer</p>
	</div>
{/if}

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.agreement-card.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.skeleton-value {
		width: 120px;
		height: 48px;
		background: linear-gradient(
			90deg,
			var(--color-border) 25%,
			var(--color-bg) 50%,
			var(--color-border) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius);
	}

	.skeleton-label {
		width: 100px;
		height: 20px;
		background: linear-gradient(
			90deg,
			var(--color-border) 25%,
			var(--color-bg) 50%,
			var(--color-border) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius);
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.empty-state.error {
		color: var(--color-danger);
	}

	.coming-soon {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.coming-soon code {
		background: var(--color-bg);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.8125rem;
	}

	.compare-selectors {
		display: flex;
		align-items: flex-end;
		gap: 1.5rem;
	}

	.selector {
		flex: 1;
	}

	.selector label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: var(--color-text-muted);
	}

	.vs {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-muted);
		padding-bottom: 0.5rem;
	}

	.metrics-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.agreement-card {
		text-align: center;
		padding: 2rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
	}

	.agreement-value {
		font-size: 3rem;
		font-weight: 700;
	}

	.agreement-value.high {
		color: var(--color-success);
	}

	.agreement-value.medium {
		color: var(--color-warning);
	}

	.agreement-value.low {
		color: var(--color-danger);
	}

	.distance-value {
		font-size: 3rem;
		font-weight: 700;
	}

	.distance-value.close {
		color: var(--color-success);
	}

	.distance-value.moderate {
		color: var(--color-warning);
	}

	.distance-value.far {
		color: var(--color-danger);
	}

	@media (max-width: 600px) {
		.metrics-row {
			grid-template-columns: 1fr;
		}
	}

	.agreement-label {
		font-size: 1.25rem;
		color: var(--color-text);
		margin-top: 0.5rem;
	}

	.agreement-detail {
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.comparison-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 2rem;
		align-items: start;
	}

	.comparison-deputy {
		flex: 1;
	}

	.comparison-dist {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	.dist-item {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.dist-item.pour {
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success);
	}

	.dist-item.contre {
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger);
	}

	.dist-item.abstention {
		background: var(--color-warning-bg, #fef3c7);
		color: var(--color-warning);
	}

	.dist-item.nonvotant {
		background: var(--color-border);
		color: var(--color-text-muted);
	}

	.comparison-stats {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
	}

	.stat-row {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.stat-value.success {
		color: var(--color-success);
	}

	.stat-value.danger {
		color: var(--color-danger);
	}

	.disagreements-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.disagreement-item {
		display: flex;
		gap: 1rem;
		padding: 0.75rem;
		border-radius: var(--radius);
	}

	.disagreement-votes {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.vote-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		background: var(--color-bg);
		color: var(--color-text-muted);
	}

	.vote-badge.pour {
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success);
	}

	.vote-badge.contre {
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger);
	}

	.vote-badge.abstention {
		background: var(--color-warning-bg, #fef3c7);
		color: var(--color-warning);
	}

	.vote-separator {
		color: var(--color-text-muted);
	}

	.disagreement-info {
		flex: 1;
		min-width: 0;
	}

	.disagreement-title {
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.disagreement-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	@media (max-width: 768px) {
		.compare-selectors {
			flex-direction: column;
		}

		.vs {
			padding: 0;
		}

		.comparison-grid {
			grid-template-columns: 1fr;
		}

		.comparison-stats {
			flex-direction: row;
			justify-content: center;
		}
	}
</style>
