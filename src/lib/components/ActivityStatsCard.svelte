<script lang="ts">
	interface ActivityStats {
		weeksPresent?: number | null;
		commissionPresences?: number | null;
		hemicycleInterventions?: number | null;
		commissionInterventions?: number | null;
		amendmentsSigned?: number | null;
		amendmentsAdopted?: number | null;
		reports?: number | null;
		writtenProposals?: number | null;
		signedProposals?: number | null;
		writtenQuestions?: number | null;
		oralQuestions?: number | null;
	}

	let {
		stats,
		source,
		chamberType = 'generic'
	}: {
		stats: ActivityStats | null;
		source: string;
		chamberType?: 'an' | 'senat' | 'pe' | 'generic';
	} = $props();

	// Determine which sections to show based on chamber type and available data
	const showPresence = $derived(
		stats && ((stats.weeksPresent ?? 0) > 0 || (stats.commissionPresences ?? 0) > 0)
	);
	const showInterventions = $derived(
		stats && ((stats.hemicycleInterventions ?? 0) > 0 || (stats.commissionInterventions ?? 0) > 0)
	);
	const showLegislative = $derived(
		stats &&
			((stats.amendmentsSigned ?? 0) > 0 ||
				(stats.amendmentsAdopted ?? 0) > 0 ||
				(stats.reports ?? 0) > 0 ||
				(stats.writtenProposals ?? 0) > 0 ||
				(stats.signedProposals ?? 0) > 0)
	);
	const showQuestions = $derived(
		stats && ((stats.writtenQuestions ?? 0) > 0 || (stats.oralQuestions ?? 0) > 0)
	);

	const hasAnyData = $derived(
		showPresence || showInterventions || showLegislative || showQuestions
	);
</script>

{#if stats && hasAnyData}
	<section class="card activity-card">
		<h2>Activite parlementaire</h2>
		<p class="section-subtitle">Donnees issues de {source}</p>
		<div class="activity-stats">
			{#if showPresence}
				<div class="stat-group">
					<h3>Presence</h3>
					<div class="stat-items">
						{#if (stats.weeksPresent ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.weeksPresent}</span>
								<span class="stat-label">semaines de presence</span>
							</div>
						{/if}
						{#if (stats.commissionPresences ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.commissionPresences}</span>
								<span class="stat-label">presences en commission</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			{#if showInterventions}
				<div class="stat-group">
					<h3>Interventions</h3>
					<div class="stat-items">
						{#if (stats.hemicycleInterventions ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.hemicycleInterventions}</span>
								<span class="stat-label">interventions en hemicycle</span>
							</div>
						{/if}
						{#if (stats.commissionInterventions ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.commissionInterventions}</span>
								<span class="stat-label">interventions en commission</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			{#if showLegislative}
				<div class="stat-group">
					<h3>Travail legislatif</h3>
					<div class="stat-items">
						{#if (stats.amendmentsSigned ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.amendmentsSigned}</span>
								<span class="stat-label">amendements signes</span>
							</div>
						{/if}
						{#if (stats.amendmentsAdopted ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.amendmentsAdopted}</span>
								<span class="stat-label">amendements adoptes</span>
							</div>
						{/if}
						{#if (stats.reports ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.reports}</span>
								<span class="stat-label">rapports</span>
							</div>
						{/if}
						{#if (stats.writtenProposals ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.writtenProposals}</span>
								<span class="stat-label">propositions ecrites</span>
							</div>
						{/if}
						{#if (stats.signedProposals ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.signedProposals}</span>
								<span class="stat-label">propositions signees</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			{#if showQuestions}
				<div class="stat-group">
					<h3>Questions</h3>
					<div class="stat-items">
						{#if (stats.writtenQuestions ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.writtenQuestions}</span>
								<span class="stat-label">questions ecrites</span>
							</div>
						{/if}
						{#if (stats.oralQuestions ?? 0) > 0}
							<div class="stat-item">
								<span class="stat-value">{stats.oralQuestions}</span>
								<span class="stat-label">questions orales</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</section>
{/if}

<style>
	.card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow-sm);
	}

	.activity-card {
		margin-bottom: 1.5rem;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.section-subtitle {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0 0 1rem 0;
	}

	.activity-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
	}

	.stat-group h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-items {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.stat-item {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	@media (max-width: 640px) {
		.activity-stats {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
