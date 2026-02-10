<script lang="ts">
	import ProfileHeader from '$lib/components/ProfileHeader.svelte';
	import GroupAlignmentCard from '$lib/components/GroupAlignmentCard.svelte';
	import ActivityStatsCard from '$lib/components/ActivityStatsCard.svelte';

	let { data } = $props();

	// Separate mandates by type
	const groupMandates = $derived(data.mandates.filter((m) => m.organType === 'GP'));
	const committeeMandates = $derived(data.mandates.filter((m) => m.organType === 'COM'));
	const delegationMandates = $derived(data.mandates.filter((m) => m.organType === 'DEL'));
	const otherMandates = $derived(
		data.mandates.filter((m) => !['GP', 'COM', 'DEL'].includes(m.organType || ''))
	);

	function formatDate(date: string | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function formatDateShort(date: string | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('fr-FR');
	}
</script>

<svelte:head>
	<title>{data.actor.fullName} - Sénateur - NosElus</title>
</svelte:head>

{#if !data.hadMandateDuringPeriod && data.filters.renouvellement && data.filters.renouvellement !== 'all'}
	<div class="period-warning">
		<p>
			<strong>{data.actor.fullName}</strong> n'était pas sénateur·rice lors du renouvellement de {data
				.filters.renouvellement}.
		</p>
		<p class="warning-hint">Changez de période pour voir son activité parlementaire.</p>
	</div>
{/if}

<ProfileHeader
	name={data.actor.fullName}
	civility={data.actor.civility}
	photoUrl={data.actor.photoUrl}
	type="senateur"
	group={data.hadMandateDuringPeriod && data.group
		? {
				id: data.group.groupId,
				name: data.group.groupName,
				shortName: data.group.groupShortName,
				color: data.group.groupColor
			}
		: null}
	profession={data.actor.profession}
	constituency={data.hadMandateDuringPeriod ? data.group?.constituency : null}
	birthDate={data.actor.birthDate}
	birthPlace={data.actor.birthPlace}
/>

{#if data.hadMandateDuringPeriod}
	{#await data.groupAlignment then groupAlignment}
		<section class="card alignment-card">
			<h2>Alignement avec le groupe</h2>
			{#if groupAlignment}
				<GroupAlignmentCard alignment={groupAlignment} group={data.group} />
			{:else}
				<p class="no-data">Les données de votes du Sénat ne sont pas encore disponibles.</p>
			{/if}
		</section>
	{/await}

	<ActivityStatsCard stats={data.activityStats} source="senat.fr" chamberType="senat" />

	<div class="info-cards">
		<section class="card">
			<h2>Informations</h2>
			<dl class="info-list">
				<div class="info-item">
					<dt>Chambre</dt>
					<dd>Sénat</dd>
				</div>
				{#if data.senatorMandate}
					<div class="info-item">
						<dt>Mandat</dt>
						<dd>
							{#if data.senatorMandate.startDate}
								Depuis {formatDate(data.senatorMandate.startDate)}
							{/if}
							{#if data.senatorMandate.endDate}
								<span class="mandate-end">jusqu'au {formatDate(data.senatorMandate.endDate)}</span>
							{:else}
								<span class="mandate-current">(en cours)</span>
							{/if}
						</dd>
					</div>
				{/if}
				{#if data.group?.constituency || data.senatorMandate?.constituency}
					<div class="info-item">
						<dt>Circonscription</dt>
						<dd>{data.group?.constituency || data.senatorMandate?.constituency}</dd>
					</div>
				{/if}
				{#if data.actor.profession}
					<div class="info-item">
						<dt>Profession</dt>
						<dd>{data.actor.profession}</dd>
					</div>
				{/if}
				{#if data.actor.birthDate}
					<div class="info-item">
						<dt>Naissance</dt>
						<dd>
							{formatDate(data.actor.birthDate)}
							{#if data.actor.birthPlace}
								<span class="birth-place">à {data.actor.birthPlace}</span>
							{/if}
						</dd>
					</div>
				{/if}
			</dl>
		</section>

		<section class="card">
			<h2>Liens externes</h2>
			<div class="external-links">
				<a
					href="https://www.senat.fr/senateur/{data.actor.uid?.toLowerCase() ?? ''}.html"
					target="_blank"
					rel="noopener noreferrer"
					class="external-link"
				>
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
						><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline
							points="15 3 21 3 21 9"
						/><line x1="10" x2="21" y1="14" y2="3" /></svg
					>
					Fiche sur senat.fr
				</a>
			</div>
		</section>
	</div>

	{#if groupMandates.length > 0}
		<section class="card mandates-section">
			<h2>Groupe politique</h2>
			<p class="section-subtitle">Historique des appartenances aux groupes parlementaires</p>
			<div class="mandates-list">
				{#each groupMandates as mandate, index}
					<div class="mandate-item" class:current={!mandate.endDate}>
						<div class="mandate-color" style="background: {mandate.organColor || '#888'}"></div>
						<div class="mandate-content">
							<div class="mandate-info">
								<span class="mandate-name">{mandate.organName}</span>
								{#if mandate.organShortName}
									<span class="mandate-short">({mandate.organShortName})</span>
								{/if}
							</div>
							{#if mandate.quality && mandate.quality !== 'Membre'}
								<div class="mandate-quality">{mandate.quality}</div>
							{/if}
							<div class="mandate-dates">
								{#if mandate.startDate}
									{formatDateShort(mandate.startDate)}
								{/if}
								{#if mandate.endDate}
									→ {formatDateShort(mandate.endDate)}
								{:else}
									→ <span class="current-badge">en cours</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if committeeMandates.length > 0}
		<section class="card mandates-section">
			<h2>Commissions</h2>
			<div class="mandates-list">
				{#each committeeMandates as mandate}
					<div class="mandate-item" class:current={!mandate.endDate}>
						<div class="mandate-content">
							<div class="mandate-info">
								<span class="mandate-name">{mandate.organName}</span>
								{#if mandate.organShortName}
									<span class="mandate-short">({mandate.organShortName})</span>
								{/if}
							</div>
							{#if mandate.quality && mandate.quality !== 'Membre'}
								<div class="mandate-quality">{mandate.quality}</div>
							{/if}
							<div class="mandate-dates">
								{#if mandate.startDate}
									{formatDateShort(mandate.startDate)}
								{/if}
								{#if mandate.endDate}
									→ {formatDateShort(mandate.endDate)}
								{:else if mandate.startDate}
									→ <span class="current-badge">en cours</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if delegationMandates.length > 0}
		<section class="card mandates-section">
			<h2>Délégations</h2>
			<div class="mandates-list">
				{#each delegationMandates as mandate}
					<div class="mandate-item" class:current={!mandate.endDate}>
						<div class="mandate-content">
							<div class="mandate-info">
								<span class="mandate-name">{mandate.organName}</span>
								{#if mandate.organShortName}
									<span class="mandate-short">({mandate.organShortName})</span>
								{/if}
							</div>
							{#if mandate.quality && mandate.quality !== 'Membre'}
								<div class="mandate-quality">{mandate.quality}</div>
							{/if}
							<div class="mandate-dates">
								{#if mandate.startDate}
									{formatDateShort(mandate.startDate)}
								{/if}
								{#if mandate.endDate}
									→ {formatDateShort(mandate.endDate)}
								{:else if mandate.startDate}
									→ <span class="current-badge">en cours</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if otherMandates.length > 0}
		<section class="card mandates-section">
			<h2>Autres fonctions</h2>
			<div class="mandates-list">
				{#each otherMandates as mandate}
					<div class="mandate-item" class:current={!mandate.endDate}>
						<div class="mandate-content">
							<div class="mandate-info">
								<span class="mandate-name">{mandate.organName}</span>
								{#if mandate.organShortName}
									<span class="mandate-short">({mandate.organShortName})</span>
								{/if}
							</div>
							{#if mandate.quality && mandate.quality !== 'Membre'}
								<div class="mandate-quality">{mandate.quality}</div>
							{/if}
							<div class="mandate-dates">
								{#if mandate.startDate}
									{formatDateShort(mandate.startDate)}
								{/if}
								{#if mandate.endDate}
									→ {formatDateShort(mandate.endDate)}
								{:else if mandate.startDate}
									→ <span class="current-badge">en cours</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
{/if}

<style>
	.period-warning {
		background: var(--color-warning-bg, #fef3c7);
		border: 1px solid var(--color-warning, #f59e0b);
		border-radius: var(--radius-lg);
		padding: 1rem 1.5rem;
		margin-bottom: 1.5rem;
	}

	.period-warning p {
		margin: 0;
		color: var(--color-text);
	}

	.period-warning .warning-hint {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-top: 0.5rem;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.info-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow-sm);
	}

	.mandates-section {
		margin-top: 1.5rem;
	}

	.section-subtitle {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0 0 1rem 0;
	}

	.info-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.info-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
		gap: 1rem;
	}

	.info-item:last-child {
		border-bottom: none;
	}

	.info-item dt {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.info-item dd {
		font-weight: 500;
		margin: 0;
		text-align: right;
	}

	.mandate-end {
		color: var(--color-text-muted);
		font-weight: 400;
	}

	.mandate-current {
		color: var(--color-success);
		font-size: 0.875rem;
	}

	.birth-place {
		color: var(--color-text-muted);
		font-weight: 400;
	}

	.external-links {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.external-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--color-text);
		transition: background 0.2s;
	}

	.external-link:hover {
		background: var(--color-border);
		text-decoration: none;
	}

	.external-link svg {
		color: var(--color-primary);
		flex-shrink: 0;
	}

	/* Mandates list */
	.mandates-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.mandate-item {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-bg);
		border-radius: var(--radius);
		transition: background 0.15s;
	}

	.mandate-item.current {
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.08));
		border-left: 3px solid var(--color-primary);
	}

	.mandate-color {
		width: 4px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.mandate-content {
		flex: 1;
		min-width: 0;
	}

	.mandate-info {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: baseline;
	}

	.mandate-name {
		font-weight: 500;
	}

	.mandate-short {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.mandate-quality {
		font-size: 0.875rem;
		color: var(--color-primary);
		margin-top: 0.25rem;
	}

	.mandate-dates {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.current-badge {
		color: var(--color-success);
		font-weight: 500;
	}

	/* Alignment card */
	.alignment-card {
		margin-bottom: 1.5rem;
	}

	.alignment-card h2 {
		margin-bottom: 0.75rem;
	}

	.no-data {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0;
	}

	@media (max-width: 640px) {
		.info-item {
			flex-direction: column;
			gap: 0.25rem;
		}

		.info-item dd {
			text-align: left;
		}
	}
</style>
