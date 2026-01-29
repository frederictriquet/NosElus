<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ElectedCard from '$lib/components/ElectedCard.svelte';
	import PeriodFilter from '$lib/components/PeriodFilter.svelte';

	let { data } = $props();

	let deputy1 = $state($page.url.searchParams.get('d1') || '');
	let deputy2 = $state($page.url.searchParams.get('d2') || '');

	function compare() {
		if (deputy1 && deputy2 && deputy1 !== deputy2) {
			const params = new URLSearchParams($page.url.searchParams);
			params.set('d1', deputy1);
			params.set('d2', deputy2);
			goto(`/compare?${params.toString()}`);
		}
	}

	function getPositionClass(position: string) {
		if (position === 'pour') return 'pour';
		if (position === 'contre') return 'contre';
		if (position === 'abstention') return 'abstention';
		return '';
	}

	function getPercent(value: number, dist: { pour: number; contre: number; abstention: number }) {
		const total = dist.pour + dist.contre + dist.abstention || 1;
		return ((value / total) * 100).toFixed(0);
	}
</script>

<svelte:head>
	<title>Comparateur - NosElus</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Comparateur de députés</h1>
	<p class="page-subtitle">Comparez les votes de deux députés</p>
</div>

<div class="filters" style="margin-bottom: 1.5rem;">
	<PeriodFilter
		legislature={data.filters?.legislature}
		dateFrom={data.filters?.dateFrom}
		dateTo={data.filters?.dateTo}
		showDateRange={true}
	/>
</div>

<div class="card" style="margin-bottom: 2rem;">
	<div class="compare-selectors">
		<div class="selector">
			<label for="deputy1">Premier député</label>
			<select id="deputy1" class="input" bind:value={deputy1}>
				<option value="">Sélectionner un député</option>
				{#each data.deputies as d}
					<option value={d.id}>{d.name}</option>
				{/each}
			</select>
		</div>
		<div class="vs">VS</div>
		<div class="selector">
			<label for="deputy2">Second député</label>
			<select id="deputy2" class="input" bind:value={deputy2}>
				<option value="">Sélectionner un député</option>
				{#each data.deputies as d}
					<option value={d.id}>{d.name}</option>
				{/each}
			</select>
		</div>
	</div>
	<div style="text-align: center; margin-top: 1.5rem;">
		<button class="btn btn-primary" onclick={compare} disabled={!deputy1 || !deputy2 || deputy1 === deputy2}>
			Comparer
		</button>
	</div>
</div>

{#if data.comparison}
	<div class="metrics-row">
		<div class="agreement-card">
			<div class="agreement-value" class:high={data.comparison.agreementRate >= 70} class:medium={data.comparison.agreementRate >= 40 && data.comparison.agreementRate < 70} class:low={data.comparison.agreementRate < 40}>
				{data.comparison.agreementRate.toFixed(1)}%
			</div>
			<div class="agreement-label">de votes identiques</div>
			<div class="agreement-detail">
				sur {data.comparison.commonVotes} votes en commun
			</div>
		</div>
		<div class="agreement-card distance-card">
			<div class="distance-value" class:close={data.comparison.politicalDistance < 20} class:moderate={data.comparison.politicalDistance >= 20 && data.comparison.politicalDistance < 50} class:far={data.comparison.politicalDistance >= 50}>
				{data.comparison.politicalDistance.toFixed(1)}
			</div>
			<div class="agreement-label">distance politique</div>
			<div class="agreement-detail">
				{#if data.comparison.politicalDistance < 20}
					Très proches
				{:else if data.comparison.politicalDistance < 35}
					Proches
				{:else if data.comparison.politicalDistance < 50}
					Modérément éloignés
				{:else if data.comparison.politicalDistance < 70}
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
				id={data.comparison.deputy1.id}
				name={data.comparison.deputy1.fullName}
				photoUrl={data.comparison.deputy1.photoUrl}
				group={data.comparison.deputy1.group}
				subtitle="{data.comparison.deputy1.voteCount} votes"
			>
				{#snippet children()}
					<div class="comparison-dist">
						<div class="dist-item pour">{getPercent(data.comparison.deputy1.distribution.pour, data.comparison.deputy1.distribution)}% pour</div>
						<div class="dist-item contre">{getPercent(data.comparison.deputy1.distribution.contre, data.comparison.deputy1.distribution)}% contre</div>
						<div class="dist-item abstention">{getPercent(data.comparison.deputy1.distribution.abstention, data.comparison.deputy1.distribution)}% abs.</div>
					</div>
				{/snippet}
			</ElectedCard>
		</div>

		<div class="comparison-stats">
			<div class="stat-row">
				<span class="stat-label">Votes identiques</span>
				<span class="stat-value success">{data.comparison.sameVotes}</span>
			</div>
			<div class="stat-row">
				<span class="stat-label">Votes différents</span>
				<span class="stat-value danger">{data.comparison.differentVotes}</span>
			</div>
		</div>

		<div class="comparison-deputy">
			<ElectedCard
				id={data.comparison.deputy2.id}
				name={data.comparison.deputy2.fullName}
				photoUrl={data.comparison.deputy2.photoUrl}
				group={data.comparison.deputy2.group}
				subtitle="{data.comparison.deputy2.voteCount} votes"
			>
				{#snippet children()}
					<div class="comparison-dist">
						<div class="dist-item pour">{getPercent(data.comparison.deputy2.distribution.pour, data.comparison.deputy2.distribution)}% pour</div>
						<div class="dist-item contre">{getPercent(data.comparison.deputy2.distribution.contre, data.comparison.deputy2.distribution)}% contre</div>
						<div class="dist-item abstention">{getPercent(data.comparison.deputy2.distribution.abstention, data.comparison.deputy2.distribution)}% abs.</div>
					</div>
				{/snippet}
			</ElectedCard>
		</div>
	</div>

	{#if data.comparison.disagreements.length > 0}
		<section class="card" style="margin-top: 2rem;">
			<h2>Votes divergents récents</h2>
			<div class="disagreements-list">
				{#each data.comparison.disagreements as d}
					<a href="/scrutins/{d.scrutinId}" class="disagreement-item">
						<div class="disagreement-votes">
							<span class="vote-badge {getPositionClass(d.position1)}">{d.position1}</span>
							<span class="vote-separator">≠</span>
							<span class="vote-badge {getPositionClass(d.position2)}">{d.position2}</span>
						</div>
						<div class="disagreement-info">
							<div class="disagreement-title">{d.scrutinTitle?.slice(0, 100)}{(d.scrutinTitle?.length || 0) > 100 ? '...' : ''}</div>
							<div class="disagreement-date">{new Date(d.scrutinDate).toLocaleDateString('fr-FR')}</div>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}
{:else if !deputy1 || !deputy2}
	<div class="empty-state">
		<p>Sélectionnez deux députés pour les comparer</p>
	</div>
{/if}

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
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
		text-decoration: none;
		color: inherit;
		transition: background 0.2s;
	}

	.disagreement-item:hover {
		background: var(--color-bg);
		text-decoration: none;
	}

	.disagreement-votes {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
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
