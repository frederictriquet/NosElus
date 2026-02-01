<script lang="ts">
	import ElectedCard from '$lib/components/ElectedCard.svelte';
	import AsyncCard from '$lib/components/AsyncCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.group.name} - Sénat - NosElus</title>
</svelte:head>

<div class="page-header">
	<div style="display: flex; align-items: center; gap: 1rem;">
		<div class="group-color" style="background: {data.group.color || '#ccc'}"></div>
		<div>
			<h1 class="page-title">{data.group.name}</h1>
			<p class="page-subtitle">{data.group.shortName}</p>
		</div>
	</div>
</div>

{#await Promise.all([data.members, data.groupStats]) then [members, groupStats]}
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">{members.length}</div>
			<div class="stat-label">Sénateurs</div>
		</div>
		{#if groupStats}
			{@const totalInterventions = (groupStats.hemicycleInterventions || 0) + (groupStats.commissionInterventions || 0)}
			<div class="stat-card">
				<div class="stat-value">{totalInterventions.toLocaleString('fr-FR')}</div>
				<div class="stat-label">Interventions</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{(groupStats.commissionPresences || 0).toLocaleString('fr-FR')}</div>
				<div class="stat-label">Présences en commission</div>
			</div>
		{/if}
	</div>
{/await}

{#await data.topMembers then topMembers}
	{#if topMembers.length > 0 && topMembers.some(m => m.hemicycleInterventions)}
		<section class="card" style="margin-top: 1.5rem;">
			<h2>Sénateurs les plus actifs</h2>
			<div class="members-list">
				{#each topMembers.filter(m => m.hemicycleInterventions) as member, i}
					<ElectedCard
						id={member.id}
						name={member.name}
						photoUrl={member.photoUrl}
						variant="inline"
						type="senateur"
						rank={i + 1}
						stat="{member.hemicycleInterventions} interventions"
					/>
				{/each}
			</div>
		</section>
	{/if}
{/await}

{#await data.groupStats then groupStats}
	{#if groupStats}
		{@const periodLabel = data.filters.renouvellement && data.filters.renouvellement !== 'all'
			? `depuis ${data.filters.renouvellement}`
			: 'toutes périodes'}
		<section class="card activity-card" style="margin-top: 1.5rem;">
			<h2>Activité parlementaire du groupe</h2>
			<p class="section-subtitle">Données agrégées des membres ({periodLabel})</p>
			<div class="activity-stats">
				{#if (groupStats.weeksPresent || 0) > 0 || (groupStats.commissionPresences || 0) > 0}
					<div class="stat-group">
						<h3>Présence</h3>
						<div class="stat-items">
							{#if (groupStats.weeksPresent || 0) > 0}
								<div class="stat-item">
									<span class="stat-value-sm">{groupStats.weeksPresent?.toLocaleString('fr-FR')}</span>
									<span class="stat-label-sm">semaines de présence cumulées</span>
								</div>
							{/if}
							{#if (groupStats.commissionPresences || 0) > 0}
								<div class="stat-item">
									<span class="stat-value-sm">{groupStats.commissionPresences?.toLocaleString('fr-FR')}</span>
									<span class="stat-label-sm">présences en commission</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
				{#if (groupStats.hemicycleInterventions || 0) > 0 || (groupStats.commissionInterventions || 0) > 0}
					<div class="stat-group">
						<h3>Interventions</h3>
						<div class="stat-items">
							{#if (groupStats.hemicycleInterventions || 0) > 0}
								<div class="stat-item">
									<span class="stat-value-sm">{groupStats.hemicycleInterventions?.toLocaleString('fr-FR')}</span>
									<span class="stat-label-sm">interventions en hémicycle</span>
								</div>
							{/if}
							{#if (groupStats.commissionInterventions || 0) > 0}
								<div class="stat-item">
									<span class="stat-value-sm">{groupStats.commissionInterventions?.toLocaleString('fr-FR')}</span>
									<span class="stat-label-sm">interventions en commission</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
				{#if (groupStats.amendmentsSigned || 0) > 0 || (groupStats.reports || 0) > 0}
					<div class="stat-group">
						<h3>Travail législatif</h3>
						<div class="stat-items">
							{#if (groupStats.amendmentsSigned || 0) > 0}
								<div class="stat-item">
									<span class="stat-value-sm">{groupStats.amendmentsSigned?.toLocaleString('fr-FR')}</span>
									<span class="stat-label-sm">amendements signés</span>
								</div>
							{/if}
							{#if (groupStats.reports || 0) > 0}
								<div class="stat-item">
									<span class="stat-value-sm">{groupStats.reports?.toLocaleString('fr-FR')}</span>
									<span class="stat-label-sm">rapports</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
				{#if (groupStats.writtenQuestions || 0) > 0 || (groupStats.oralQuestions || 0) > 0}
					<div class="stat-group">
						<h3>Questions</h3>
						<div class="stat-items">
							{#if (groupStats.writtenQuestions || 0) > 0}
								<div class="stat-item">
									<span class="stat-value-sm">{groupStats.writtenQuestions?.toLocaleString('fr-FR')}</span>
									<span class="stat-label-sm">questions écrites</span>
								</div>
							{/if}
							{#if (groupStats.oralQuestions || 0) > 0}
								<div class="stat-item">
									<span class="stat-value-sm">{groupStats.oralQuestions?.toLocaleString('fr-FR')}</span>
									<span class="stat-label-sm">questions orales</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</section>
	{/if}
{/await}

{#await data.members}
	<section class="card" style="margin-top: 1.5rem;">
		<h2>Membres du groupe</h2>
		<div class="loading-state">Chargement...</div>
	</section>
{:then members}
	<section class="card" style="margin-top: 1.5rem;">
		<h2>Membres du groupe ({members.length})</h2>
		{#if members.length === 0}
			<p class="empty-state">Aucun sénateur trouvé dans ce groupe</p>
		{:else}
			<div class="members-grid">
				{#each members as member}
					<ElectedCard
						id={member.id}
						name={member.name}
						photoUrl={member.photoUrl}
						variant="compact"
						type="senateur"
					/>
				{/each}
			</div>
		{/if}
	</section>
{:catch}
	<section class="card" style="margin-top: 1.5rem;">
		<h2>Membres du groupe</h2>
		<p class="empty-state">Erreur de chargement</p>
	</section>
{/await}

<section class="card" style="margin-top: 1.5rem;">
	<h2>Informations</h2>
	<dl style="margin-top: 1rem;">
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Sigle</dt>
			<dd>{data.group.shortName || '-'}</dd>
		</div>
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Chambre</dt>
			<dd>Sénat</dd>
		</div>
	</dl>
</section>

<div class="info-box" style="margin-top: 1.5rem;">
	<strong>Votes nominatifs non disponibles</strong>
	<p>Le Sénat ne publie pas les votes individuels nominatifs de manière exploitable. Seules les statistiques d'activité sont affichées.</p>
</div>

<style>
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.group-color {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	dl {
		margin: 0;
	}

	dt, dd {
		margin: 0;
	}

	/* Stats grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat-card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		text-align: center;
		box-shadow: var(--shadow-sm);
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	/* Activity stats card */
	.activity-card h2 {
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

	.stat-value-sm {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.stat-label-sm {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	/* Members list */
	.members-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 1rem;
	}

	.members-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.info-box {
		background: var(--color-warning-bg, #fef3c7);
		border: 1px solid var(--color-warning, #f59e0b);
		border-radius: var(--radius);
		padding: 1rem;
		font-size: 0.875rem;
		color: var(--color-warning-text, #92400e);
	}

	.info-box strong {
		display: block;
		margin-bottom: 0.5rem;
	}

	.info-box p {
		margin: 0;
	}

	.loading-state {
		color: var(--color-text-muted);
		padding: 2rem;
		text-align: center;
	}

	@media (max-width: 640px) {
		.activity-stats {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
