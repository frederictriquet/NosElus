<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		chamberPeriodStore,
		getPeriodShortLabel,
		type Chamber,
		type PeriodValue
	} from '$lib/stores/chamber-period';

	interface Period {
		value: string;
		label: string;
		startDate: string;
		endDate: string | null;
	}

	interface Props {
		periods: Period[];
		chamber: Chamber;
		label: string; // "Législature", "Terme", "Renouvellement"
		allLabel: string; // "Toutes les législatures", "Tous les termes", etc.
		urlParam: string; // "legislature", "terme", "renouvellement"
	}

	let { periods, chamber, label, allLabel, urlParam }: Props = $props();

	let isOpen = $state(false);

	// Valeur actuelle depuis l'URL (réactif via $page)
	let currentValue = $derived<PeriodValue>($page.url.searchParams.get(urlParam));

	function handleSelect(value: PeriodValue) {
		chamberPeriodStore.set(chamber, value);
		isOpen = false;

		// Mettre à jour l'URL
		const currentPath = $page.url.pathname;
		const urlParams = new URLSearchParams($page.url.searchParams);
		if (value) {
			urlParams.set(urlParam, value);
		} else {
			urlParams.delete(urlParam);
		}
		// Reset pagination
		urlParams.delete('page');
		goto(`${currentPath}?${urlParams.toString()}`, { replaceState: true });
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.period-selector')) {
			isOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="period-selector">
	<button class="selector-trigger" onclick={() => (isOpen = !isOpen)} aria-expanded={isOpen}>
		<span class="selector-label">{label}</span>
		<span class="selector-value">{getPeriodShortLabel(chamber, currentValue)}</span>
		<svg class="selector-chevron" class:open={isOpen} viewBox="0 0 20 20" fill="currentColor">
			<path
				fill-rule="evenodd"
				d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>

	{#if isOpen}
		<div class="selector-dropdown">
			<button
				class="dropdown-item"
				class:active={currentValue === null}
				onclick={() => handleSelect(null)}
			>
				{allLabel}
			</button>
			{#each periods as period}
				<button
					class="dropdown-item"
					class:active={currentValue === period.value}
					onclick={() => handleSelect(period.value)}
				>
					{period.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.period-selector {
		position: relative;
	}

	.selector-trigger {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.8125rem;
	}

	.selector-trigger:hover {
		border-color: var(--color-primary);
	}

	.selector-label {
		color: var(--color-text-muted);
		font-weight: 400;
	}

	.selector-value {
		color: var(--color-text);
		font-weight: 600;
	}

	.selector-chevron {
		width: 1rem;
		height: 1rem;
		color: var(--color-text-muted);
		transition: transform 0.2s;
	}

	.selector-chevron.open {
		transform: rotate(180deg);
	}

	.selector-dropdown {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		min-width: 180px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 100;
		overflow: hidden;
	}

	.dropdown-item {
		display: block;
		width: 100%;
		padding: 0.625rem 0.875rem;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--color-text);
		transition: background 0.15s;
	}

	.dropdown-item:hover {
		background: var(--color-bg);
	}

	.dropdown-item.active {
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
		color: var(--color-primary);
		font-weight: 500;
	}

	/* Mobile */
	@media (max-width: 640px) {
		.selector-label {
			display: none;
		}

		.selector-dropdown {
			right: -0.5rem;
		}
	}
</style>
