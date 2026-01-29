<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import '../app.css';
	import LegislatureSelector from '$lib/components/LegislatureSelector.svelte';
	import { legislatureStore } from '$lib/stores/legislature';

	let { children, data } = $props();

	// Initialiser le store avec la législature courante au premier chargement
	$effect(() => {
		if (browser && data.currentLegislature) {
			legislatureStore.initialize(data.currentLegislature);
		}
	});

	// Synchroniser l'URL vers le store quand on navigue
	$effect(() => {
		if (browser) {
			const urlLegislature = $page.url.searchParams.get('legislature');
			if (urlLegislature !== null) {
				// Vérifier que c'est une législature valide
				const isValid = data.legislatures.some((l: { value: string }) => l.value === urlLegislature);
				if (isValid) {
					legislatureStore.set(urlLegislature);
				}
			}
		}
	});

	// Fonction pour générer les liens avec le paramètre legislature
	function navLink(path: string): string {
		if (!$legislatureStore) return path;
		return `${path}?legislature=${$legislatureStore}`;
	}
</script>

<svelte:head>
	<title>NosElus - Suivi de l'activité parlementaire</title>
	<meta name="description" content="Suivez l'activité des députés et sénateurs français" />
</svelte:head>

<header class="header">
	<div class="container header-content">
		<a href={navLink('/')} class="logo">NosElus</a>
		<nav class="nav">
			<a href={navLink('/')} class:active={$page.url.pathname === '/'}>Accueil</a>
			<a href={navLink('/deputes')} class:active={$page.url.pathname.startsWith('/deputes')}>Députés</a>
			<a href={navLink('/scrutins')} class:active={$page.url.pathname.startsWith('/scrutins')}>Scrutins</a>
			<a href={navLink('/groupes')} class:active={$page.url.pathname.startsWith('/groupes')}>Groupes</a>
			<a href={navLink('/stats')} class:active={$page.url.pathname.startsWith('/stats')}>Stats</a>
			<a href={navLink('/carte')} class:active={$page.url.pathname.startsWith('/carte')}>Carte</a>
			<a href={navLink('/compare')} class:active={$page.url.pathname.startsWith('/compare')}>Comparer</a>
		</nav>
		<LegislatureSelector legislatures={data.legislatures} />
	</div>
</header>

<main class="main">
	<div class="container">
		{@render children()}
	</div>
</main>

<footer class="footer">
	<div class="container" style="text-align: center; color: var(--color-text-muted); font-size: 0.875rem;">
		<p>NosElus - Données issues de <a href="https://nosdeputes.fr" target="_blank">NosDéputés.fr</a></p>
	</div>
</footer>

<style>
	:global(html, body) {
		height: 100%;
		margin: 0;
	}

	:global(body) {
		display: flex;
		flex-direction: column;
	}

	.main {
		flex: 1 0 auto;
		padding-bottom: 2rem;
	}

	.footer {
		flex-shrink: 0;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		padding: 1.5rem 0;
	}
</style>
