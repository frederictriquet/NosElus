<script lang="ts">
	let { data } = $props();

	function getTotalVotes() {
		return data.distribution.pour + data.distribution.contre + data.distribution.abstention;
	}
</script>

<svelte:head>
	<title>{data.group.name} - NosElus</title>
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

<div class="stats-grid" style="margin-bottom: 1.5rem;">
	<div class="stat-card">
		<div class="stat-value">{data.totalVotes.toLocaleString('fr-FR')}</div>
		<div class="stat-label">Votes enregistrés</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{data.members.length}</div>
		<div class="stat-label">Députés actifs</div>
	</div>
	<div class="stat-card">
		<div class="stat-value" style="color: var(--color-success);">
			{getTotalVotes() > 0 ? ((data.distribution.pour / getTotalVotes()) * 100).toFixed(0) : 0}%
		</div>
		<div class="stat-label">Votes pour</div>
	</div>
	<div class="stat-card">
		<div class="stat-value" style="color: var(--color-danger);">
			{getTotalVotes() > 0 ? ((data.distribution.contre / getTotalVotes()) * 100).toFixed(0) : 0}%
		</div>
		<div class="stat-label">Votes contre</div>
	</div>
</div>

<div class="card-grid">
	<section class="card">
		<h2>Répartition des votes</h2>
		{#if getTotalVotes() > 0}
			<div class="vote-bar" style="height: 24px; border-radius: 12px; margin-top: 1rem;">
				<div class="vote-bar-for" style="width: {(data.distribution.pour / getTotalVotes()) * 100}%"></div>
				<div class="vote-bar-against" style="width: {(data.distribution.contre / getTotalVotes()) * 100}%"></div>
				<div class="vote-bar-abstention" style="width: {(data.distribution.abstention / getTotalVotes()) * 100}%"></div>
			</div>
			<div style="display: flex; justify-content: space-around; margin-top: 1rem; text-align: center;">
				<div>
					<div style="font-size: 1.25rem; font-weight: 700; color: var(--color-success);">{data.distribution.pour.toLocaleString('fr-FR')}</div>
					<div style="font-size: 0.875rem; color: var(--color-text-muted);">Pour</div>
				</div>
				<div>
					<div style="font-size: 1.25rem; font-weight: 700; color: var(--color-danger);">{data.distribution.contre.toLocaleString('fr-FR')}</div>
					<div style="font-size: 0.875rem; color: var(--color-text-muted);">Contre</div>
				</div>
				<div>
					<div style="font-size: 1.25rem; font-weight: 700; color: var(--color-warning);">{data.distribution.abstention.toLocaleString('fr-FR')}</div>
					<div style="font-size: 0.875rem; color: var(--color-text-muted);">Abstention</div>
				</div>
			</div>
		{:else}
			<p class="empty-state">Aucun vote enregistré</p>
		{/if}
	</section>

	<section class="card">
		<h2>Députés les plus actifs</h2>
		{#if data.members.length === 0}
			<p class="empty-state">Aucun membre trouvé</p>
		{:else}
			<div class="members-list">
				{#each data.members as member, i}
					<a href="/deputes/{member.id}" class="member-item">
						<span class="member-rank">{i + 1}</span>
						<img src={member.photoUrl || '/placeholder.png'} alt={member.name} class="member-photo" />
						<span class="member-name">{member.name}</span>
						<span class="member-votes">{member.voteCount} votes</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>

{#if data.monthlyActivity.length > 0}
<section class="card" style="margin-top: 1.5rem;">
	<h2>Évolution des votes</h2>
	<div class="evolution-chart">
		{#each data.monthlyActivity.slice(-12) as month}
			{@const maxTotal = Math.max(...data.monthlyActivity.map(m => m.total))}
			{@const height = (month.total / maxTotal) * 100}
			{@const pourPct = month.total > 0 ? (month.pour / month.total) * 100 : 0}
			{@const contrePct = month.total > 0 ? (month.contre / month.total) * 100 : 0}
			{@const abstPct = month.total > 0 ? (month.abstention / month.total) * 100 : 0}
			<div class="evolution-bar-container" title="{month.month}: {month.total} votes">
				<div class="evolution-bar" style="height: {height}%;">
					<div class="bar-segment pour" style="height: {pourPct}%"></div>
					<div class="bar-segment contre" style="height: {contrePct}%"></div>
					<div class="bar-segment abstention" style="height: {abstPct}%"></div>
				</div>
				<span class="evolution-label">{month.month.slice(5)}</span>
			</div>
		{/each}
	</div>
	<div class="evolution-legend">
		<span class="legend-item"><span class="legend-box pour"></span> Pour</span>
		<span class="legend-item"><span class="legend-box contre"></span> Contre</span>
		<span class="legend-item"><span class="legend-box abstention"></span> Abstention</span>
	</div>
</section>
{/if}

<section class="card" style="margin-top: 1.5rem;">
	<h2>Informations</h2>
	<dl style="margin-top: 1rem;">
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Sigle</dt>
			<dd>{data.group.shortName || '-'}</dd>
		</div>
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Législature</dt>
			<dd>{data.group.legislature || '-'}</dd>
		</div>
		<div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
			<dt style="color: var(--color-text-muted); width: 120px;">Chambre</dt>
			<dd>{data.group.chamber === 'AN' ? 'Assemblée nationale' : data.group.chamber || '-'}</dd>
		</div>
	</dl>
</section>

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

	/* Members list */
	.members-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.member-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
		transition: background 0.2s;
	}

	.member-item:hover {
		background: var(--color-bg);
		text-decoration: none;
	}

	.member-rank {
		width: 20px;
		text-align: center;
		font-weight: 700;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.member-photo {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--color-border);
	}

	.member-name {
		flex: 1;
		font-weight: 500;
		font-size: 0.875rem;
	}

	.member-votes {
		color: var(--color-primary);
		font-weight: 600;
		font-size: 0.875rem;
	}

	/* Evolution chart */
	.evolution-chart {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		height: 150px;
		margin-top: 1rem;
		padding-bottom: 2rem;
	}

	.evolution-bar-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		position: relative;
	}

	.evolution-bar {
		width: 100%;
		display: flex;
		flex-direction: column-reverse;
		border-radius: 4px 4px 0 0;
		overflow: hidden;
		min-height: 4px;
		margin-top: auto;
	}

	.bar-segment {
		width: 100%;
	}

	.bar-segment.pour {
		background: var(--color-success);
	}

	.bar-segment.contre {
		background: var(--color-danger);
	}

	.bar-segment.abstention {
		background: var(--color-warning);
	}

	.evolution-label {
		position: absolute;
		bottom: -1.5rem;
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.evolution-legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		font-size: 0.75rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.legend-box {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}

	.legend-box.pour {
		background: var(--color-success);
	}

	.legend-box.contre {
		background: var(--color-danger);
	}

	.legend-box.abstention {
		background: var(--color-warning);
	}
</style>
