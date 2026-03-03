<script lang="ts">
	import { getDominant } from '$lib/utils/bilan';
	let { data } = $props();
	const tag = $derived(data.theme.tag);
	const groupBilans = $derived(data.theme.groupBilans);
	const scrutins = $derived(data.theme.scrutins);

	/** Parse ISO date string (YYYY-MM-DD) in local timezone */
	function parseLocalDate(isoDate: string): Date {
		const [y, m, d] = isoDate.split('-').map(Number);
		return new Date(y, m - 1, d);
	}
</script>

<svelte:head>
	<title>{tag.name} — Thèmes — NosElus</title>
	<meta
		name="description"
		content="Bilan des votes parlementaires sur le thème {tag.name} par groupe politique"
	/>
</svelte:head>

<div class="page-header">
	<div class="breadcrumb">
		<a href="/themes">Thèmes</a>
		<span class="breadcrumb-sep">›</span>
		<span>{tag.name}</span>
	</div>
	<h1 class="page-title">
		<span class="tag-dot" style="background: {tag.color ?? '#64748b'}"></span>
		{tag.name}
	</h1>
	<p class="page-subtitle">
		{scrutins.length} scrutin{scrutins.length > 1 ? 's' : ''} analysé{scrutins.length > 1
			? 's'
			: ''} — votes officiels à l'Assemblée nationale
	</p>
</div>

<section class="bilan-section card">
	<h2 class="section-title">Bilan par groupe politique</h2>
	<p class="bilan-note">
		Position dominante par scrutin (pour / contre / abstention). Groupes présents dans au moins la
		moitié des scrutins.
	</p>

	{#if groupBilans.length === 0}
		<p class="text-muted">Données de vote insuffisantes pour calculer un bilan.</p>
	{:else}
		<div class="bilan-table">
			{#each groupBilans as bilan}
				{@const dominant = getDominant(bilan)}
				{@const pctPour = Math.round((bilan.scrutinsPour / bilan.totalScrutins) * 100)}
				{@const pctContre = Math.round((bilan.scrutinsContre / bilan.totalScrutins) * 100)}
				{@const pctAbstention = Math.round((bilan.scrutinsAbstention / bilan.totalScrutins) * 100)}
				<div class="bilan-row">
					<div class="group-info">
						<span class="group-name">{bilan.shortName}</span>
					</div>
					<div class="vote-bars">
						{#if pctPour > 0}
							<span
								class="bar-seg pour"
								style="width: {pctPour}%"
								title="Pour : {bilan.scrutinsPour}/{bilan.totalScrutins}"
							></span>
						{/if}
						{#if pctContre > 0}
							<span
								class="bar-seg contre"
								style="width: {pctContre}%"
								title="Contre : {bilan.scrutinsContre}/{bilan.totalScrutins}"
							></span>
						{/if}
						{#if pctAbstention > 0}
							<span
								class="bar-seg abstention"
								style="width: {pctAbstention}%"
								title="Abstention : {bilan.scrutinsAbstention}/{bilan.totalScrutins}"
							></span>
						{/if}
					</div>
					<div class="bilan-verdict {dominant}">
						<span aria-hidden="true"
							>{dominant === 'pour' ? '✅' : dominant === 'contre' ? '❌' : '🟡'}</span
						>
						{dominant === 'pour' ? 'POUR' : dominant === 'contre' ? 'CONTRE' : 'ABST.'}
						<span class="verdict-detail"
							>{bilan[
								dominant === 'pour'
									? 'scrutinsPour'
									: dominant === 'contre'
										? 'scrutinsContre'
										: 'scrutinsAbstention'
							]}/{bilan.totalScrutins}</span
						>
					</div>
				</div>
			{/each}
		</div>
		<div class="legend">
			<span class="legend-item"><span class="legend-dot pour"></span> Pour</span>
			<span class="legend-item"><span class="legend-dot contre"></span> Contre</span>
			<span class="legend-item"><span class="legend-dot abstention"></span> Abstention</span>
		</div>
	{/if}
</section>

<section class="scrutins-section">
	<h2 class="section-title">Scrutins ({scrutins.length})</h2>
	<div class="scrutins-list">
		{#each scrutins as scrutin}
			<a href="/an/scrutins/{scrutin.id}" class="scrutin-card">
				<div class="scrutin-body">
					<div class="scrutin-title">{scrutin.title}</div>
					<div class="scrutin-meta">
						{#if scrutin.date}
							<span>{parseLocalDate(scrutin.date).toLocaleDateString('fr-FR')}</span>
						{/if}
					</div>
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
</section>

<style>
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-bottom: 0.5rem;
	}

	.breadcrumb a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
	}

	.breadcrumb-sep {
		opacity: 0.5;
	}

	.page-title {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.tag-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.bilan-section {
		margin-bottom: 2rem;
		padding: 1.5rem;
	}

	.section-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
	}

	.bilan-note {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0 0 1.25rem 0;
	}

	.text-muted {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.bilan-table {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.bilan-row {
		display: grid;
		grid-template-columns: 6rem 1fr 7rem;
		align-items: center;
		gap: 0.75rem;
	}

	.group-info {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.group-name {
		font-weight: 700;
		font-size: 0.875rem;
	}

	.vote-bars {
		height: 10px;
		display: flex;
		border-radius: 5px;
		overflow: hidden;
		background: var(--color-bg);
	}

	.bar-seg {
		display: block;
		height: 100%;
	}

	.bar-seg.pour {
		background: var(--color-success);
	}

	.bar-seg.contre {
		background: var(--color-danger);
	}

	.bar-seg.abstention {
		background: var(--color-warning);
	}

	.bilan-verdict {
		font-size: 0.8125rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		justify-content: flex-end;
	}

	.bilan-verdict.pour {
		color: var(--color-success);
	}

	.bilan-verdict.contre {
		color: var(--color-danger);
	}

	.bilan-verdict.abstention {
		color: var(--color-warning-text, #92400e);
	}

	.verdict-detail {
		font-weight: 400;
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.legend {
		display: flex;
		gap: 1rem;
		margin-top: 0.75rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.legend-dot.pour {
		background: var(--color-success);
	}

	.legend-dot.contre {
		background: var(--color-danger);
	}

	.legend-dot.abstention {
		background: var(--color-warning);
	}

	.scrutins-section {
		margin-bottom: 2rem;
	}

	.scrutins-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1rem;
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
	}

	.scrutin-body {
		flex: 1;
		min-width: 0;
	}

	.scrutin-title {
		font-weight: 500;
		line-height: 1.4;
		margin-bottom: 0.25rem;
		font-size: 0.9375rem;
	}

	.scrutin-meta {
		font-size: 0.75rem;
		color: var(--color-text-muted);
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
		background: var(--color-success-bg);
		color: var(--color-success-text);
	}

	.result-badge.rejete {
		background: var(--color-danger-bg);
		color: var(--color-danger-text);
	}

	@media (max-width: 640px) {
		.bilan-row {
			grid-template-columns: 4rem 1fr 6rem;
		}
	}
</style>
