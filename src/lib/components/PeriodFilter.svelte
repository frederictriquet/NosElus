<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	interface Props {
		/** Législature actuelle (ex: "17") */
		legislature?: string | null;
		/** Date de début du filtre */
		dateFrom?: string | null;
		/** Date de fin du filtre */
		dateTo?: string | null;
		/** Afficher les champs de date (défaut: false) */
		showDateRange?: boolean;
		/** Mode compact inline (défaut: false) */
		compact?: boolean;
	}

	let {
		legislature = null,
		dateFrom = null,
		dateTo = null,
		showDateRange = false,
		compact = false
	}: Props = $props();

	// Données des législatures
	const LEGISLATURES = [
		{ value: '17', label: '17e (2024-)', start: '2024-07-18', end: null },
		{ value: '16', label: '16e (2022-2024)', start: '2022-06-28', end: '2024-06-09' },
		{ value: '15', label: '15e (2017-2022)', start: '2017-06-27', end: '2022-06-21' },
		{ value: '14', label: '14e (2012-2017)', start: '2012-06-20', end: '2017-06-20' },
		{ value: '13', label: '13e (2007-2012)', start: '2007-06-20', end: '2012-06-19' },
		{ value: '12', label: '12e (2002-2007)', start: '2002-06-25', end: '2007-06-19' }
	];

	// Vérifie si des filtres sont actifs
	const hasActiveFilters = $derived(
		legislature !== null || dateFrom !== null || dateTo !== null
	);

	function updateFilters(params: { legislature?: string | null; dateFrom?: string | null; dateTo?: string | null }) {
		const urlParams = new URLSearchParams($page.url.searchParams);

		// Mise à jour des paramètres
		if (params.legislature !== undefined) {
			if (params.legislature) {
				urlParams.set('legislature', params.legislature);
			} else {
				urlParams.delete('legislature');
			}
		}

		if (params.dateFrom !== undefined) {
			if (params.dateFrom) {
				urlParams.set('dateFrom', params.dateFrom);
			} else {
				urlParams.delete('dateFrom');
			}
		}

		if (params.dateTo !== undefined) {
			if (params.dateTo) {
				urlParams.set('dateTo', params.dateTo);
			} else {
				urlParams.delete('dateTo');
			}
		}

		// Reset pagination
		urlParams.set('page', '1');

		goto(`?${urlParams.toString()}`);
	}

	function handleLegislatureChange(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value || null;
		updateFilters({ legislature: value });
	}

	function handleDateFromChange(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).value || null;
		updateFilters({ dateFrom: value });
	}

	function handleDateToChange(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).value || null;
		updateFilters({ dateTo: value });
	}

	function clearFilters() {
		updateFilters({ legislature: null, dateFrom: null, dateTo: null });
	}
</script>

<div class="period-filter" class:compact>
	<div class="filter-group">
		<label for="legislature-filter" class="filter-label">Législature</label>
		<select
			id="legislature-filter"
			class="input"
			value={legislature || ''}
			onchange={handleLegislatureChange}
		>
			<option value="">Toutes les législatures</option>
			{#each LEGISLATURES as leg}
				<option value={leg.value}>{leg.label}</option>
			{/each}
		</select>
	</div>

	{#if showDateRange}
		<div class="filter-group">
			<label for="date-from-filter" class="filter-label">Du</label>
			<input
				type="date"
				id="date-from-filter"
				class="input"
				value={dateFrom || ''}
				onchange={handleDateFromChange}
			/>
		</div>

		<div class="filter-group">
			<label for="date-to-filter" class="filter-label">Au</label>
			<input
				type="date"
				id="date-to-filter"
				class="input"
				value={dateTo || ''}
				onchange={handleDateToChange}
			/>
		</div>
	{/if}

	{#if hasActiveFilters}
		<button class="btn-clear" onclick={clearFilters} title="Effacer les filtres">
			Effacer
		</button>
	{/if}
</div>

<style>
	.period-filter {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-end;
	}

	.period-filter.compact {
		gap: 0.5rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.compact .filter-group {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.compact .filter-label {
		font-size: 0.875rem;
	}

	.period-filter :global(.input) {
		min-width: 180px;
	}

	.compact :global(.input) {
		min-width: 150px;
	}

	.btn-clear {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-clear:hover {
		color: var(--color-danger);
		border-color: var(--color-danger);
		background: var(--color-danger-bg, rgba(239, 68, 68, 0.1));
	}

	/* Responsive */
	@media (max-width: 640px) {
		.period-filter {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-group {
			width: 100%;
		}

		.period-filter :global(.input) {
			width: 100%;
			min-width: unset;
		}

		.btn-clear {
			width: 100%;
		}
	}
</style>
