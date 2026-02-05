<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// État local pour la chambre active
	let activeChamber = $state<'AN' | 'PE' | 'SENAT'>('AN');

	// Filtre par mandature (par chambre)
	let selectedLegislature = $state<Record<string, string>>({
		AN: '',
		PE: '',
		SENAT: ''
	});

	// Groupes filtrés par mandature
	const filteredGroups = $derived.by(() => {
		if (!data.authenticated || !data.groups) return [];
		const groups = data.groups[activeChamber] ?? [];
		const leg = selectedLegislature[activeChamber];
		if (!leg) return groups;
		// Cas spécial : "__none__" = groupes sans legislature
		if (leg === '__none__') return groups.filter((g) => !g.legislature);
		return groups.filter((g) => g.legislature === leg);
	});

	// État local pour les positions (permet édition avant sauvegarde)
	let editedPositions = $state<Record<string, number>>({});

	// État du formulaire de login
	let loginError = $state('');
	let isSubmitting = $state(false);

	// Chambers labels
	const chamberLabels = {
		AN: 'Assemblée nationale',
		PE: 'Parlement européen',
		SENAT: 'Sénat'
	};

	const legislatureLabels: Record<string, (leg: string) => string> = {
		AN: (leg) => `${leg}e législature`,
		PE: (leg) => `${leg}e terme`,
		SENAT: (leg) => leg // Géré par les labels du serveur
	};

	// Label de la mandature pour l'affichage dans le tableau
	function getLegislatureDisplay(chamber: string, leg: string | null): string {
		if (!leg) return '—';
		if (chamber === 'SENAT') return leg === 'SENAT' ? 'Actuel' : leg;
		return leg;
	}

	// Récupérer la position (éditée ou originale)
	function getPosition(organId: string, originalPosition: number | null): number {
		return editedPositions[organId] ?? originalPosition ?? 5.0;
	}

	// Handler pour changement de position
	function handlePositionChange(organId: string, value: string) {
		const num = parseFloat(value);
		if (!isNaN(num)) {
			editedPositions[organId] = num;
		}
	}
</script>

<svelte:head>
	<title>Administration - NosElus</title>
</svelte:head>

{#if !data.authenticated}
	<!-- Formulaire de login -->
	<div class="login-container">
		<div class="login-card">
			<h1>Administration</h1>
			<p class="login-subtitle">Connexion requise</p>

			{#if loginError}
				<div class="error-banner">{loginError}</div>
			{/if}

			<form
				method="POST"
				action="?/login"
				use:enhance={() => {
					isSubmitting = true;
					loginError = '';
					return async ({ result, update }) => {
						isSubmitting = false;
						if (result.type === 'failure') {
							loginError = result.data?.error || 'Erreur de connexion';
						}
						await update();
					};
				}}
			>
				<div class="form-group">
					<label for="password">Mot de passe</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						disabled={isSubmitting}
						placeholder="Entrez le mot de passe admin"
					/>
				</div>

				<button type="submit" class="btn-primary" disabled={isSubmitting}>
					{isSubmitting ? 'Connexion...' : 'Se connecter'}
				</button>
			</form>
		</div>
	</div>
{:else}
	<!-- Interface admin -->
	<div class="page-header">
		<h1 class="page-title">Administration</h1>
		<div class="header-actions">
			<form method="POST" action="?/logout" use:enhance>
				<button type="submit" class="btn-secondary">Déconnexion</button>
			</form>
		</div>
	</div>

	<!-- Onglets chambres -->
	<div class="tabs">
		{#each Object.entries(chamberLabels) as [key, label]}
			<button
				class="tab"
				class:active={activeChamber === key}
				onclick={() => (activeChamber = key as 'AN' | 'PE' | 'SENAT')}
			>
				{label}
			</button>
		{/each}
	</div>

	<!-- Contenu par chambre -->
	<div class="admin-content">
		<!-- Switch protection ETL -->
		<div class="etl-protection">
			<form
				method="POST"
				action="?/toggleEtlProtection"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<input type="hidden" name="chamber" value={activeChamber} />
				<input
					type="hidden"
					name="enabled"
					value={data.etlSettings[`etl_protect_${activeChamber.toLowerCase()}`] ? 'false' : 'true'}
				/>
				<label class="switch-label">
					<input
						type="checkbox"
						checked={data.etlSettings[`etl_protect_${activeChamber.toLowerCase()}`]}
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					/>
					<span>Protéger les positions contre l'ETL automatique</span>
				</label>
			</form>
			<p class="help-text">
				{#if data.etlSettings[`etl_protect_${activeChamber.toLowerCase()}`]}
					✅ Les positions de cette chambre ne seront pas écrasées par l'import automatique ParlGov
				{:else}
					⚠️ Les positions de cette chambre peuvent être écrasées par l'import automatique ParlGov
				{/if}
			</p>
		</div>

		<!-- Liste des groupes -->
		<div class="groups-list">
			<div class="groups-header">
				<h2>Groupes parlementaires - {chamberLabels[activeChamber]}</h2>

				{#if data.legislatures[activeChamber]?.length > 0}
					<select
						class="legislature-select"
						value={selectedLegislature[activeChamber]}
						onchange={(e) => (selectedLegislature[activeChamber] = e.currentTarget.value)}
					>
						<option value="">Tous</option>
						{#each data.legislatures[activeChamber] as leg}
							<option value={leg.value}>
								{activeChamber === 'SENAT' ? leg.label : legislatureLabels[activeChamber](leg.value)}
							</option>
						{/each}
					</select>
				{/if}
			</div>

			{#if filteredGroups.length === 0}
				<p class="empty-state">Aucun groupe parlementaire pour cette sélection</p>
			{:else}
				<p class="groups-count">{filteredGroups.length} groupes</p>
				<table class="groups-table">
					<thead>
						<tr>
							<th>Nom</th>
							<th>Sigle</th>
							{#if !selectedLegislature[activeChamber]}
								<th>Mandature</th>
							{/if}
							<th>Position</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredGroups as group}
							<tr>
								<td>
									<div class="group-name">
										{#if group.color}
											<span class="color-dot" style="background-color: {group.color}"></span>
										{/if}
										{group.name}
									</div>
								</td>
								<td><code>{group.shortName || '—'}</code></td>
								{#if !selectedLegislature[activeChamber]}
									<td>{getLegislatureDisplay(activeChamber, group.legislature)}</td>
								{/if}
								<td>
									<input
										type="number"
										step="0.1"
										min="0"
										max="999"
										value={getPosition(group.id, group.politicalPosition)}
										oninput={(e) => handlePositionChange(group.id, e.currentTarget.value)}
										class="position-input"
									/>
								</td>
								<td>
									<form
										method="POST"
										action="?/updatePosition"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
												// Réinitialiser l'édition après sauvegarde
												delete editedPositions[group.id];
											};
										}}
									>
										<input type="hidden" name="organId" value={group.id} />
										<input
											type="hidden"
											name="position"
											value={getPosition(group.id, group.politicalPosition)}
										/>
										<button
											type="submit"
											class="btn-save"
											disabled={!(group.id in editedPositions)}
										>
											Sauvegarder
										</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
{/if}

<style>
	.login-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 60vh;
		padding: 2rem;
	}

	.login-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 2rem;
		width: 100%;
		max-width: 400px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.login-card h1 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
	}

	.login-subtitle {
		color: var(--color-text-muted);
		margin: 0 0 1.5rem 0;
		font-size: 0.875rem;
	}

	.error-banner {
		background: #fee;
		border: 1px solid #fcc;
		color: #c33;
		padding: 0.75rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.form-group input {
		width: 100%;
		padding: 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 1rem;
		background: var(--color-bg);
		color: var(--color-text);
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.btn-primary {
		width: 100%;
		padding: 0.75rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-dark, #2563eb);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: 0.5rem 1rem;
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-secondary:hover {
		background: var(--color-bg);
		border-color: var(--color-text-muted);
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 2px solid var(--color-border);
		margin-bottom: 1.5rem;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		margin-bottom: -2px;
	}

	.tab:hover {
		color: var(--color-text);
		background: var(--color-bg);
	}

	.tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.admin-content {
		max-width: 1200px;
	}

	.etl-protection {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.switch-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-weight: 500;
	}

	.switch-label input[type='checkbox'] {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.help-text {
		margin: 0.5rem 0 0 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.groups-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.groups-list h2 {
		font-size: 1.125rem;
		margin: 0;
	}

	.legislature-select {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 0.875rem;
		background: var(--color-bg);
		color: var(--color-text);
		cursor: pointer;
	}

	.legislature-select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	.groups-count {
		margin: 0 0 0.5rem 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.groups-table {
		width: 100%;
		border-collapse: collapse;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}

	.groups-table thead {
		background: var(--color-bg);
	}

	.groups-table th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
	}

	.groups-table td {
		padding: 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.groups-table tbody tr:last-child td {
		border-bottom: none;
	}

	.group-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.color-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.position-input {
		width: 80px;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 0.875rem;
		background: var(--color-bg);
		color: var(--color-text);
	}

	.position-input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	.btn-save {
		padding: 0.375rem 0.75rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-save:hover:not(:disabled) {
		background: var(--color-primary-dark, #2563eb);
	}

	.btn-save:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: var(--color-text-muted);
		font-style: italic;
	}

	@media (max-width: 768px) {
		.groups-table {
			font-size: 0.8125rem;
		}

		.groups-table th,
		.groups-table td {
			padding: 0.5rem;
		}

		.position-input {
			width: 60px;
		}
	}
</style>
