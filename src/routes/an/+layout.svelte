<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import PeriodSelector from '$lib/components/PeriodSelector.svelte';
	import { chamberPeriodStore } from '$lib/stores/chamber-period';

	let { children, data } = $props();

	// Initialiser le store avec la législature courante au premier chargement
	$effect(() => {
		if (browser && data.currentLegislature) {
			chamberPeriodStore.initialize('an', data.currentLegislature);
		}
	});

	// Synchroniser l'URL vers le store quand on navigue
	$effect(() => {
		if (browser) {
			const urlLegislature = $page.url.searchParams.get('legislature');
			if (urlLegislature !== null) {
				const isValid = data.legislatures.some(
					(l: { value: string }) => l.value === urlLegislature
				);
				if (isValid) {
					chamberPeriodStore.set('an', urlLegislature);
				}
			}
		}
	});

	// Fonction pour générer les liens avec le paramètre legislature
	function navLink(path: string): string {
		let legislature: string | null = null;
		chamberPeriodStore.subscribe((state) => {
			legislature = state.an;
		})();
		if (!legislature) return path;
		return `${path}?legislature=${legislature}`;
	}

	const subNavItems = [
		{ href: '/an/deputes', label: 'Députés', match: '/an/deputes' },
		{ href: '/an/scrutins', label: 'Scrutins', match: '/an/scrutins' },
		{ href: '/an/groupes', label: 'Groupes', match: '/an/groupes' },
		{ href: '/an/stats', label: 'Stats', match: '/an/stats' },
		{ href: '/an/carte', label: 'Carte', match: '/an/carte' },
		{ href: '/an/compare', label: 'Comparer', match: '/an/compare' }
	];
</script>

<div class="chamber-layout">
	<div class="chamber-header">
		<nav class="sub-nav">
			{#each subNavItems as item}
				<a
					href={navLink(item.href)}
					class:active={$page.url.pathname.startsWith(item.match)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
		<PeriodSelector
			periods={data.legislatures}
			chamber="an"
			label="Législature"
			allLabel="Toutes les législatures"
			urlParam="legislature"
		/>
	</div>
	{@render children()}
</div>

<style>
	.chamber-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.chamber-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.sub-nav {
		display: flex;
		gap: 0.25rem;
	}

	.sub-nav a {
		padding: 0.5rem 0.875rem;
		border-radius: var(--radius);
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-decoration: none;
		transition: all 0.15s;
	}

	.sub-nav a:hover {
		color: var(--color-text);
		background: var(--color-bg);
	}

	.sub-nav a.active {
		color: var(--color-primary);
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.chamber-header {
			flex-direction: column;
			gap: 0.75rem;
			align-items: stretch;
		}

		.sub-nav {
			overflow-x: auto;
			padding-bottom: 0.5rem;
			-webkit-overflow-scrolling: touch;
		}

		.sub-nav a {
			white-space: nowrap;
			padding: 0.375rem 0.625rem;
			font-size: 0.8125rem;
		}
	}
</style>
