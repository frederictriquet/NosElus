<script lang="ts">
	import AsyncCard from '$lib/components/AsyncCard.svelte';
	import ProfileHeader from '$lib/components/ProfileHeader.svelte';
	import GroupAlignmentCard from '$lib/components/GroupAlignmentCard.svelte';
	import ActivityStatsCard from '$lib/components/ActivityStatsCard.svelte';
	import VoteEvolutionChart from '$lib/components/VoteEvolutionChart.svelte';

	let { data } = $props();

	// Separate mandates by type
	const groupMandates = $derived.by(() => {
		return data.mandates.then((m) => m.filter((mandate) => mandate.organType === 'GP'));
	});
	const committeeMandates = $derived.by(() => {
		return data.mandates.then((m) => m.filter((mandate) => mandate.organType === 'COM'));
	});
	const delegationMandates = $derived.by(() => {
		return data.mandates.then((m) => m.filter((mandate) => mandate.organType === 'DEL'));
	});
	const otherMandates = $derived.by(() => {
		return data.mandates.then((m) =>
			m.filter((mandate) => !['GP', 'COM', 'DEL'].includes(mandate.organType || ''))
		);
	});

	function formatDateShort(date: string | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('fr-FR');
	}
</script>

<svelte:head>
	<title>{data.actor.fullName} - NosElus</title>
</svelte:head>

{#if !data.hadMandateDuringPeriod && data.filters.legislature && data.filters.legislature !== 'all'}
	<div class="period-warning">
		<p>
			<strong>{data.actor.fullName}</strong> n'était pas député·e durant la {data.filters
				.legislature}e législature.
		</p>
		<p class="warning-hint">Changez de législature pour voir son activité parlementaire.</p>
	</div>
{/if}

{#await data.voteStats then voteStats}
	<ProfileHeader
		name={data.actor.fullName}
		civility={data.actor.civility}
		photoUrl={data.actor.photoUrl}
		type="depute"
		group={data.group
			? {
					id: data.group.groupId,
					name: data.group.groupName,
					shortName: data.group.groupShortName,
					color: data.group.groupColor
				}
			: null}
		profession={data.actor.profession}
		birthDate={data.actor.birthDate}
		birthPlace={data.actor.birthPlace}
		timeline={data.hadMandateDuringPeriod ? voteStats.timeline : null}
	/>
{/await}

{#if data.hadMandateDuringPeriod}
	<ActivityStatsCard stats={data.activityStats} source="NosDéputés.fr" chamberType="an" />

	<AsyncCard title="Statistiques de vote" promise={data.voteStats} minHeight="180px">
		{#snippet children(voteStats)}
			<p style="color: var(--color-text-muted); margin: 0.5rem 0 1rem;">
				{voteStats.voteCount} votes enregistrés
			</p>

			{@const totalVotes =
				voteStats.distribution.pour +
				voteStats.distribution.contre +
				voteStats.distribution.abstention +
				voteStats.distribution['non-votant']}
			{#if totalVotes > 0}
				<div class="vote-bar" style="height: 24px; border-radius: 12px;">
					<div
						class="vote-bar-for"
						style="width: {(voteStats.distribution.pour / totalVotes) * 100}%"
					></div>
					<div
						class="vote-bar-against"
						style="width: {(voteStats.distribution.contre / totalVotes) * 100}%"
					></div>
					<div
						class="vote-bar-abstention"
						style="width: {(voteStats.distribution.abstention / totalVotes) * 100}%"
					></div>
					{#if voteStats.distribution['non-votant'] > 0}
						<div
							class="vote-bar-nonvotant"
							style="width: {(voteStats.distribution['non-votant'] / totalVotes) * 100}%"
						></div>
					{/if}
				</div>
				<div
					style="display: flex; justify-content: space-around; margin-top: 1rem; text-align: center;"
				>
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">
							{voteStats.distribution.pour}
						</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Pour</div>
					</div>
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-danger);">
							{voteStats.distribution.contre}
						</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Contre</div>
					</div>
					<div>
						<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">
							{voteStats.distribution.abstention}
						</div>
						<div style="font-size: 0.875rem; color: var(--color-text-muted);">Abstention</div>
					</div>
					{#if voteStats.distribution['non-votant'] > 0}
						<div>
							<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-text-muted);">
								{voteStats.distribution['non-votant']}
							</div>
							<div style="font-size: 0.875rem; color: var(--color-text-muted);">Non-votants</div>
						</div>
					{/if}
				</div>

				{#await data.groupAlignment then groupAlignment}
					<GroupAlignmentCard alignment={groupAlignment} group={data.group} />
				{/await}
			{:else}
				<p class="empty-state">Aucun vote enregistré</p>
			{/if}
		{/snippet}
	</AsyncCard>

	<div style="margin-top: 1.5rem;">
		<AsyncCard
			title="Autonomie de vote"
			subtitle="Divergence par rapport au groupe"
			promise={data.autonomyStats}
			minHeight="200px"
		>
			{#snippet children(stats)}
				{#if stats}
					<div class="stats-grid">
						<div class="stat-box">
							<div class="stat-value">{stats.divergenceRate.toFixed(1)}%</div>
							<div class="stat-label">Taux de divergence</div>
						</div>
						<div class="stat-box">
							<div class="stat-value">{stats.divergentVotes}</div>
							<div class="stat-label">Votes divergents</div>
						</div>
						<div class="stat-box">
							<div class="stat-value">{stats.totalComparableVotes}</div>
							<div class="stat-label">Votes analysés</div>
						</div>
					</div>

					{#if stats.byCategory.length > 0}
						<div style="margin-top: 1.5rem;">
							<h4 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem;">
								Par catégorie de scrutin
							</h4>
							<div class="category-list">
								{#each stats.byCategory as cat}
									<div class="category-item">
										<div class="category-name">{cat.label}</div>
										<div class="category-stats">
											<span class="category-rate">{cat.divergenceRate.toFixed(1)}%</span>
											<span class="category-count">({cat.divergentVotes}/{cat.totalVotes})</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<p style="margin-top: 1rem; font-size: 0.75rem; color: #6b7280;">
						Mesure l'écart entre le vote du député et la position majoritaire de son groupe. Base : {stats.totalComparableVotes}
						vote{stats.totalComparableVotes > 1 ? 's' : ''}.
					</p>
				{:else}
					<p class="empty-state">Données insuffisantes pour calculer l'autonomie de vote</p>
				{/if}
			{/snippet}
		</AsyncCard>
	</div>

	<div style="margin-top: 1.5rem;">
		<AsyncCard
			title="Votes serrés"
			subtitle="Scrutins où chaque voix comptait"
			promise={data.tightVoteStats}
			minHeight="200px"
		>
			{#snippet children(stats)}
				{#if stats && stats.totalTightVotes > 0}
					<div class="stats-grid">
						<div class="stat-box">
							<div class="stat-value">{stats.totalTightVotes}</div>
							<div class="stat-label">Votes serrés</div>
						</div>
						{#if stats.tieVotes > 0}
							<div class="stat-box">
								<div class="stat-value" style="color: var(--color-primary);">{stats.tieVotes}</div>
								<div class="stat-label">Égalités</div>
							</div>
						{/if}
						<div class="stat-box">
							<div class="stat-value" style="color: var(--color-success);">
								{stats.winningVotes}
							</div>
							<div class="stat-label">Camp gagnant</div>
						</div>
						<div class="stat-box">
							<div class="stat-value" style="color: var(--color-danger);">{stats.losingVotes}</div>
							<div class="stat-label">Camp perdant</div>
						</div>
					</div>

					{#if stats.recentTightVotes.length > 0}
						<div style="margin-top: 1.5rem;">
							<h4 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem;">
								Derniers votes serrés
							</h4>
							<div class="tight-votes-list">
								{#each stats.recentTightVotes as vote}
									<a href="/an/scrutins/{vote.scrutinId}" class="tight-vote-item">
										<div class="tight-vote-info">
											<div class="tight-vote-title">
												{vote.scrutinTitle.slice(0, 100)}{vote.scrutinTitle.length > 100
													? '...'
													: ''}
											</div>
											<div class="tight-vote-meta">
												<span class="tight-vote-date"
													>{new Date(vote.scrutinDate).toLocaleDateString('fr-FR')}</span
												>
												<span
													class="tight-vote-position"
													class:pour={vote.actorPosition === 'pour'}
													class:contre={vote.actorPosition === 'contre'}
												>
													{vote.actorPosition}
												</span>
												{#if vote.wasWinning !== null}
													<span
														class="tight-vote-result"
														class:winning={vote.wasWinning}
														class:losing={!vote.wasWinning}
													>
														{vote.wasWinning ? '✓ gagnant' : '✗ perdant'}
													</span>
												{/if}
											</div>
										</div>
										<div class="tight-vote-margin">
											{#if vote.isTie}
												<span class="tie-badge">Égalité</span>
											{:else}
												<span class="margin-badge">±{vote.margin}</span>
											{/if}
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<p style="margin-top: 1rem; font-size: 0.75rem; color: #6b7280;">
						Scrutins avec une marge de victoire ≤ 10 voix. Base : {stats.totalTightVotes} scrutin{stats.totalTightVotes >
						1
							? 's'
							: ''}.
					</p>
				{:else}
					<p class="empty-state">Aucune participation à un vote serré durant cette période</p>
				{/if}
			{/snippet}
		</AsyncCard>
	</div>

	<div style="margin-top: 1.5rem;">
		<AsyncCard title="Derniers votes" promise={data.recentVotes} minHeight="300px">
			{#snippet children(recentVotes)}
				{#if recentVotes.length === 0}
					<p class="empty-state">Aucun vote enregistré</p>
				{:else}
					<div class="votes-list">
						{#each recentVotes as vote}
							<a href="/an/scrutins/{vote.scrutinId}" class="vote-item">
								<span
									class="vote-position"
									class:pour={vote.position === 'pour'}
									class:contre={vote.position === 'contre'}
									class:abstention={vote.position === 'abstention'}
								>
									{vote.position}
								</span>
								<div class="vote-info">
									<div class="vote-title">
										{vote.scrutinTitle?.slice(0, 120)}{(vote.scrutinTitle?.length || 0) > 120
											? '...'
											: ''}
									</div>
									<div class="vote-date">
										{new Date(vote.scrutinDate).toLocaleDateString('fr-FR')}
									</div>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			{/snippet}
		</AsyncCard>
	</div>

	<div style="margin-top: 1.5rem;">
		<AsyncCard
			title="Évolution des votes"
			subtitle="Répartition des votes par mois"
			promise={data.monthlyEvolution}
			minHeight="220px"
		>
			{#snippet children(monthlyEvolution)}
				<VoteEvolutionChart
					data={monthlyEvolution}
					height={180}
					periodStart={data.periodDates?.start}
					periodEnd={data.periodDates?.end}
				/>
			{/snippet}
		</AsyncCard>
	</div>

	<div style="margin-top: 1.5rem;">
		<AsyncCard title="Parcours parlementaire" promise={data.careerMilestones} minHeight="150px">
			{#snippet children(careerMilestones)}
				{#if careerMilestones.length > 0}
					<div class="career-timeline">
						{#each careerMilestones as milestone}
							<div
								class="timeline-item"
								class:first={milestone.type === 'first_vote'}
								class:last={milestone.type === 'last_vote'}
							>
								<div class="timeline-marker">
									{#if milestone.type === 'first_vote'}
										<span class="marker-icon">&#9654;</span>
									{:else if milestone.type === 'last_vote'}
										<span class="marker-icon">&#9632;</span>
									{:else}
										<span class="marker-icon">&#9733;</span>
									{/if}
								</div>
								<div class="timeline-content">
									<div class="timeline-date">
										{new Date(milestone.date).toLocaleDateString('fr-FR', {
											day: 'numeric',
											month: 'long',
											year: 'numeric'
										})}
									</div>
									<div class="timeline-title">{milestone.title}</div>
									{#if milestone.description}
										<div class="timeline-desc">{milestone.description}</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="empty-state">Aucune donnée de parcours</p>
				{/if}
			{/snippet}
		</AsyncCard>
	</div>

	<!-- Mandate sections -->
	{#await groupMandates then mandates}
		{#if mandates.length > 0}
			<section class="card mandates-section">
				<h2>Groupe politique</h2>
				<p class="section-subtitle">Historique des appartenances aux groupes parlementaires</p>
				<div class="mandates-list">
					{#each mandates as mandate}
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
	{/await}

	{#await committeeMandates then mandates}
		{#if mandates.length > 0}
			<section class="card mandates-section">
				<h2>Commissions</h2>
				<div class="mandates-list">
					{#each mandates as mandate}
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
	{/await}

	{#await delegationMandates then mandates}
		{#if mandates.length > 0}
			<section class="card mandates-section">
				<h2>Délégations</h2>
				<div class="mandates-list">
					{#each mandates as mandate}
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
	{/await}

	{#await otherMandates then mandates}
		{#if mandates.length > 0}
			<section class="card mandates-section">
				<h2>Autres fonctions</h2>
				<div class="mandates-list">
					{#each mandates as mandate}
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
	{/await}

	{#await data.amendmentStats then amendmentStats}
		{#if amendmentStats.total > 0}
			<div class="card-grid" style="margin-top: 1.5rem;">
				<AsyncCard title="Amendements déposés" promise={data.amendmentStats} minHeight="180px">
					{#snippet children(amendmentStats)}
						<p style="color: var(--color-text-muted); margin: 0.5rem 0 1rem;">
							{amendmentStats.total} amendement{amendmentStats.total > 1 ? 's' : ''}
						</p>

						{@const totalAmendments =
							amendmentStats.adopte +
							amendmentStats.rejete +
							amendmentStats.retire +
							amendmentStats.tombe +
							amendmentStats.autre}
						{#if totalAmendments > 0}
							<div class="amendment-bar" style="height: 24px; border-radius: 12px;">
								<div
									class="amendment-bar-adopte"
									style="width: {(amendmentStats.adopte / totalAmendments) * 100}%"
								></div>
								<div
									class="amendment-bar-rejete"
									style="width: {(amendmentStats.rejete / totalAmendments) * 100}%"
								></div>
								<div
									class="amendment-bar-retire"
									style="width: {(amendmentStats.retire / totalAmendments) * 100}%"
								></div>
								<div
									class="amendment-bar-tombe"
									style="width: {(amendmentStats.tombe / totalAmendments) * 100}%"
								></div>
							</div>
							<div
								style="display: flex; justify-content: space-around; margin-top: 1rem; text-align: center; flex-wrap: wrap; gap: 0.5rem;"
							>
								<div>
									<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">
										{amendmentStats.adopte}
									</div>
									<div style="font-size: 0.875rem; color: var(--color-text-muted);">Adoptés</div>
								</div>
								<div>
									<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-danger);">
										{amendmentStats.rejete}
									</div>
									<div style="font-size: 0.875rem; color: var(--color-text-muted);">Rejetés</div>
								</div>
								<div>
									<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">
										{amendmentStats.retire}
									</div>
									<div style="font-size: 0.875rem; color: var(--color-text-muted);">Retirés</div>
								</div>
								<div>
									<div style="font-size: 1.5rem; font-weight: 700; color: var(--color-text-muted);">
										{amendmentStats.tombe}
									</div>
									<div style="font-size: 0.875rem; color: var(--color-text-muted);">Tombés</div>
								</div>
							</div>
						{/if}
					{/snippet}
				</AsyncCard>

				<AsyncCard title="Derniers amendements" promise={data.recentAmendments} minHeight="300px">
					{#snippet children(recentAmendments)}
						{#if recentAmendments.length === 0}
							<p class="empty-state">Aucun amendement enregistré</p>
						{:else}
							<div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
								{#each recentAmendments as amendment}
									<div class="amendment-item">
										<span
											class="amendment-status"
											class:adopte={amendment.status?.toLowerCase().includes('adopt')}
											class:rejete={amendment.status?.toLowerCase().includes('rejet')}
											class:retire={amendment.status?.toLowerCase().includes('retir')}
											class:tombe={amendment.status?.toLowerCase().includes('tomb')}
										>
											{amendment.status || 'En cours'}
										</span>
										<div class="amendment-info">
											<div class="amendment-number">
												Amendement n°{amendment.number}
												{#if amendment.article}
													<span class="amendment-article">sur {amendment.article}</span>
												{/if}
											</div>
											{#if amendment.exposeSommaire}
												<div class="amendment-summary">
													{amendment.exposeSommaire.slice(0, 100)}{amendment.exposeSommaire.length >
													100
														? '...'
														: ''}
												</div>
											{/if}
											{#if amendment.depositDate}
												<div class="amendment-date">
													{new Date(amendment.depositDate).toLocaleDateString('fr-FR')}
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/snippet}
				</AsyncCard>

				<AsyncCard title="Textes signés" promise={data.lawsImplication} minHeight="300px">
					{#snippet children(lawsImplication)}
						{#if lawsImplication.length === 0}
							<p class="empty-state">Aucun texte signé enregistré</p>
						{:else}
							<p style="color: var(--color-text-muted); margin: 0.5rem 0 1rem;">
								{lawsImplication.length} texte{lawsImplication.length > 1 ? 's' : ''}
								({lawsImplication.filter((l) => l.role === 'author').length} comme auteur,
								{lawsImplication.filter((l) => l.role === 'cosignatory').length} comme cosignataire)
							</p>
							<div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
								{#each lawsImplication as law}
									<a href="/an/laws/{law.lawId}" class="law-item" title="Voir le détail du texte">
										<span
											class="law-role"
											class:author={law.role === 'author'}
											class:cosignatory={law.role === 'cosignatory'}
										>
											{law.role === 'author' ? 'Auteur' : 'Cosignataire'}
										</span>
										<div class="law-info">
											<div class="law-title">{law.lawTitle}</div>
											{#if law.depositDate}
												<div class="law-date">
													{new Date(law.depositDate).toLocaleDateString('fr-FR')}
												</div>
											{/if}
										</div>
									</a>
								{/each}
							</div>
						{/if}
					{/snippet}
				</AsyncCard>
			</div>
		{/if}
	{/await}
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
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	/* Career Timeline */
	.career-timeline {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin-top: 1rem;
		position: relative;
		padding-left: 2rem;
	}

	.career-timeline::before {
		content: '';
		position: absolute;
		left: 0.5rem;
		top: 0.5rem;
		bottom: 0.5rem;
		width: 2px;
		background: var(--color-border);
	}

	.timeline-item {
		display: flex;
		gap: 1rem;
		padding: 0.75rem 0;
		position: relative;
	}

	.timeline-marker {
		position: absolute;
		left: -1.5rem;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--color-surface);
		border: 2px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
	}

	.timeline-item.first .timeline-marker {
		border-color: var(--color-success);
		color: var(--color-success);
	}

	.timeline-item.last .timeline-marker {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.marker-icon {
		line-height: 1;
	}

	.timeline-content {
		flex: 1;
	}

	.timeline-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.timeline-title {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.timeline-desc {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.votes-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.vote-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		text-decoration: none;
		color: inherit;
		padding: 0.75rem;
		border-radius: var(--radius);
		background: var(--color-bg);
		transition:
			background 0.2s,
			box-shadow 0.2s;
	}

	.vote-item:hover {
		background: var(--color-border);
		text-decoration: none;
		box-shadow: var(--shadow-sm);
	}

	.vote-info {
		flex: 1;
		min-width: 0;
	}

	.vote-title {
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.vote-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	@media (max-width: 768px) {
		.votes-list {
			grid-template-columns: 1fr;
		}
	}

	/* Amendments styles */
	.amendment-bar {
		display: flex;
		background: var(--color-bg);
		overflow: hidden;
	}

	.amendment-bar-adopte {
		background: var(--color-success);
	}

	.amendment-bar-rejete {
		background: var(--color-danger);
	}

	.amendment-bar-retire {
		background: var(--color-warning);
	}

	.amendment-bar-tombe {
		background: var(--color-text-muted);
	}

	.amendment-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: var(--radius);
	}

	.amendment-status {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		white-space: nowrap;
		background: var(--color-bg);
		color: var(--color-text-muted);
	}

	.amendment-status.adopte {
		background: var(--color-success-bg, #dcfce7);
		color: var(--color-success);
	}

	.amendment-status.rejete {
		background: var(--color-danger-bg, #fde2e2);
		color: var(--color-danger);
	}

	.amendment-status.retire {
		background: var(--color-warning-bg, #fef3c7);
		color: var(--color-warning);
	}

	.amendment-status.tombe {
		background: var(--color-bg);
		color: var(--color-text-muted);
	}

	.amendment-info {
		flex: 1;
		min-width: 0;
	}

	.amendment-number {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.amendment-article {
		font-weight: 400;
		color: var(--color-text-muted);
	}

	.amendment-summary {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
		line-height: 1.4;
	}

	.amendment-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	/* Card and mandates styles */
	.card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
	}

	.mandates-section {
		margin-top: 1.5rem;
	}

	.section-subtitle {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0 0 1rem 0;
	}

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
		border: 1px solid var(--color-primary);
	}

	.mandate-color {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		align-self: center;
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
		font-weight: 600;
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

	/* Autonomy Stats */
	.category-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.category-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
	}

	.category-name {
		font-size: 0.875rem;
		color: var(--color-text);
	}

	.category-stats {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.category-rate {
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--color-text);
	}

	.category-count {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	/* Law Implication */
	.law-item {
		display: flex;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: background 0.2s;
	}

	.law-item:hover {
		background: var(--color-bg-tertiary);
	}

	.law-role {
		flex-shrink: 0;
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.law-role.author {
		background: var(--color-primary-bg, #e0e7ff);
		color: var(--color-primary, #4f46e5);
	}

	.law-role.cosignatory {
		background: var(--color-secondary-bg, #f3f4f6);
		color: var(--color-text-muted);
	}

	.law-info {
		flex: 1;
		min-width: 0;
	}

	.law-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.law-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	/* Tight votes styles */
	.tight-votes-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tight-vote-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: inherit;
		transition: all 0.2s;
	}

	.tight-vote-item:hover {
		background: var(--color-bg-hover);
		transform: translateX(2px);
	}

	.tight-vote-info {
		flex: 1;
		min-width: 0;
	}

	.tight-vote-title {
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.tight-vote-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	.tight-vote-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.tight-vote-position {
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius-xs);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.tight-vote-position.pour {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.tight-vote-position.contre {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.tight-vote-result {
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius-xs);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.tight-vote-result.winning {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.tight-vote-result.losing {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}

	.tight-vote-margin {
		flex-shrink: 0;
	}

	.margin-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		background: var(--color-warning-bg);
		color: var(--color-warning);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		font-family: var(--font-mono);
	}

	.tie-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		background: var(--color-primary-bg);
		color: var(--color-primary);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
	}
</style>
