<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();
	let searchInput = $state('');

	function handleSearch(e: Event) {
		e.preventDefault();
		if (searchInput.trim().length >= 2) {
			goto(`/recherche?q=${encodeURIComponent(searchInput.trim())}`);
		}
	}
</script>

<div class="page-header">
	<h1 class="page-title">Suivi de l'activité parlementaire</h1>
	<p class="page-subtitle">Explorez les votes et activités des élus français</p>
</div>

<div class="home-search">
	<form onsubmit={handleSearch} class="home-search-form">
		<input
			type="text"
			class="input home-search-input"
			placeholder="Rechercher : SMIC RN vote, retraites LFI, immigration..."
			bind:value={searchInput}
		/>
		<button type="submit" class="btn btn-primary">Rechercher</button>
	</form>
	<div class="home-hints">
		<a href="/verifier" class="verifier-link">
			Vous avez lu une affirmation politique ? Vérifiez-la →
		</a>
		<a href="/themes" class="verifier-link"> Explorez par thème : retraites, pouvoir d'achat… → </a>
		<a href="/calendrier" class="verifier-link"> Calendrier des votes → </a>
	</div>
</div>

<div class="chambers-grid">
	<a href="/an" class="chamber-card an">
		<div class="chamber-icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M3 21h18" />
				<path d="M5 21V7l7-4 7 4v14" />
				<path d="M9 21v-8h6v8" />
			</svg>
		</div>
		<h2 class="chamber-title">Assemblée nationale</h2>
		<div class="chamber-stats">
			<span>{data.chambers.an.deputies} députés</span>
			<span>•</span>
			<span>{data.chambers.an.groups} groupes</span>
		</div>
		<p class="chamber-desc">Votes, scrutins et activités des députés français</p>
	</a>

	<a href="/senat" class="chamber-card senat">
		<div class="chamber-icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
				<path d="M2 12h20" />
			</svg>
		</div>
		<h2 class="chamber-title">Sénat</h2>
		<div class="chamber-stats">
			<span>{data.chambers.senat.senators} sénateurs</span>
			<span>•</span>
			<span>{data.chambers.senat.groups} groupes</span>
		</div>
		<p class="chamber-desc">Sénateurs et groupes politiques du Sénat</p>
	</a>

	<a href="/pe" class="chamber-card pe">
		<div class="chamber-icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="M2 12h20" />
				<path
					d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
				/>
			</svg>
		</div>
		<h2 class="chamber-title">Parlement européen</h2>
		<div class="chamber-stats">
			<span>{data.chambers.pe.meps} eurodéputés</span>
			<span>•</span>
			<span>{data.chambers.pe.groups} groupes</span>
		</div>
		<p class="chamber-desc">Eurodéputés français et leurs votes au PE</p>
	</a>
</div>

{#if data.recentScrutins.length > 0}
	<section class="card recent-scrutins">
		<h2>Derniers scrutins</h2>
		<div class="scrutins-list">
			{#each data.recentScrutins as scrutin}
				{@const total = scrutin.totalFor + scrutin.totalAgainst + scrutin.totalAbstention || 1}
				<a
					href="/an/scrutins/{scrutin.id}"
					class="scrutin-card"
					class:adopted={scrutin.result === 'adopté'}
					class:rejected={scrutin.result === 'rejeté'}
				>
					<div class="scrutin-title">
						{scrutin.title.slice(0, 100)}{scrutin.title.length > 100 ? '...' : ''}
					</div>
					<div class="scrutin-meta">
						<span>{new Date(scrutin.date).toLocaleDateString('fr-FR')}</span>
						<span
							class="scrutin-result"
							class:adopted={scrutin.result === 'adopté'}
							class:rejected={scrutin.result === 'rejeté'}
						>
							{scrutin.result}
						</span>
						<span>{scrutin.totalVoters} votants</span>
					</div>
					<div class="vote-bar">
						<div class="vote-bar-for" style="width: {(scrutin.totalFor / total) * 100}%"></div>
						<div
							class="vote-bar-against"
							style="width: {(scrutin.totalAgainst / total) * 100}%"
						></div>
						<div
							class="vote-bar-abstention"
							style="width: {(scrutin.totalAbstention / total) * 100}%"
						></div>
					</div>
				</a>
			{/each}
		</div>
		<div class="scrutins-footer">
			<a href="/an/scrutins" class="btn btn-secondary">Voir tous les scrutins</a>
		</div>
	</section>
{/if}

<style>
	.home-search {
		margin-bottom: 2rem;
	}

	.home-search-form {
		display: flex;
		gap: 1rem;
	}

	.home-search-input {
		flex: 1;
		font-size: 1.0625rem;
		padding: 0.875rem 1.25rem;
	}

	.home-search-form .btn {
		min-height: 3.25rem;
		padding: 0.875rem 1.5rem;
	}

	.home-hints {
		margin-top: 0.625rem;
		display: flex;
		justify-content: flex-end;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.verifier-link {
		font-size: 0.875rem;
		color: var(--color-primary);
		text-decoration: none;
	}

	.verifier-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 640px) {
		.home-search-form {
			flex-direction: column;
		}
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.chambers-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.chamber-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 2rem 1.5rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 2px solid var(--color-border);
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.2s,
			box-shadow 0.2s,
			border-color 0.2s,
			background 0.2s;
	}

	.chamber-card.an {
		background: rgba(37, 99, 235, 0.03);
	}

	.chamber-card.senat {
		background: rgba(147, 51, 234, 0.03);
	}

	.chamber-card.pe {
		background: rgba(3, 105, 161, 0.03);
	}

	.chamber-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-md);
		text-decoration: none;
	}

	.chamber-card.an:hover {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.07);
	}

	.chamber-card.senat:hover {
		border-color: var(--chamber-senat);
		background: rgba(147, 51, 234, 0.07);
	}

	.chamber-card.pe:hover {
		border-color: var(--chamber-pe);
		background: rgba(3, 105, 161, 0.07);
	}

	.chamber-icon {
		width: 96px;
		height: 96px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		margin-bottom: 1.25rem;
	}

	.chamber-card.an .chamber-icon {
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
		color: var(--color-primary);
	}

	.chamber-card.senat .chamber-icon {
		background: rgba(147, 51, 234, 0.1);
		color: var(--chamber-senat);
	}

	.chamber-card.pe .chamber-icon {
		background: rgba(3, 105, 161, 0.1);
		color: var(--chamber-pe);
	}

	.chamber-title {
		font-size: 1.375rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
	}

	.chamber-card.an .chamber-title {
		color: var(--color-primary);
	}

	.chamber-card.senat .chamber-title {
		color: var(--chamber-senat);
	}

	.chamber-card.pe .chamber-title {
		color: var(--chamber-pe);
	}

	.chamber-stats {
		display: flex;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-bottom: 0.75rem;
	}

	.chamber-desc {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.5;
	}

	.scrutin-card {
		display: block;
		text-decoration: none;
		color: inherit;
	}

	.scrutin-card:hover {
		text-decoration: none;
	}

	.recent-scrutins {
		margin-top: 2rem;
	}

	.scrutins-list {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.scrutins-footer {
		margin-top: 1rem;
		text-align: center;
	}
</style>
