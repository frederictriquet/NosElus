<script lang="ts">
	import { page } from '$app/stores';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>NosElus - Suivi de l'activité parlementaire</title>
	<meta name="description" content="Suivez l'activité des députés et sénateurs français" />
</svelte:head>

<header class="header">
	<div class="container header-content">
		<a href="/" class="logo">NosElus</a>
		<nav class="nav">
			<a href="/" class:active={$page.url.pathname === '/'}>Accueil</a>
			<a href="/deputes" class:active={$page.url.pathname.startsWith('/deputes')}>Députés</a>
			<a href="/scrutins" class:active={$page.url.pathname.startsWith('/scrutins')}>Scrutins</a>
			<a href="/groupes" class:active={$page.url.pathname.startsWith('/groupes')}>Groupes</a>
			<a href="/stats" class:active={$page.url.pathname.startsWith('/stats')}>Stats</a>
			<a href="/carte" class:active={$page.url.pathname.startsWith('/carte')}>Carte</a>
			<a href="/compare" class:active={$page.url.pathname.startsWith('/compare')}>Comparer</a>
		</nav>
	</div>
</header>

<main>
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
	.footer {
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		padding: 1.5rem 0;
		margin-top: auto;
	}
</style>
