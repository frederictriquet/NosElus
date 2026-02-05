<script lang="ts">
	import { page } from '$app/stores';
	import '../app.css';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();

	// Déterminer quelle chambre est active
	const activeChamber = $derived(() => {
		const path = $page.url.pathname;
		if (path.startsWith('/an')) return 'an';
		if (path.startsWith('/senat')) return 'senat';
		if (path.startsWith('/pe')) return 'pe';
		return null;
	});

	const chamberTabs = [
		{ href: '/an', label: 'Assemblée nationale', key: 'an' },
		{ href: '/senat', label: 'Sénat', key: 'senat' },
		{ href: '/pe', label: 'Parlement européen', key: 'pe' }
	];
</script>

<svelte:head>
	<title>NosElus - Suivi de l'activité parlementaire</title>
	<meta name="description" content="Suivez l'activité des députés et sénateurs français" />
</svelte:head>

<header class="header">
	<div class="container header-content">
		<a href="/" class="logo">NosElus</a>
		<nav class="nav chamber-nav">
			{#each chamberTabs as tab}
				<a href={tab.href} class:active={activeChamber() === tab.key}>
					{tab.label}
				</a>
			{/each}
		</nav>
		<div class="header-links">
			<ThemeToggle />
			<a href="/sources" class="header-link" class:active={$page.url.pathname === '/sources'}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
					<path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
					<path d="M3 12A9 3 0 0 0 21 12"></path>
				</svg>
				<span class="link-label">Sources</span>
			</a>
			<a href="/recherche" class="header-link" class:active={$page.url.pathname.startsWith('/recherche')}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"></circle>
					<path d="m21 21-4.3-4.3"></path>
				</svg>
				<span class="link-label">Recherche</span>
			</a>
		</div>
	</div>
</header>

<main class="main">
	<div class="container">
		{@render children()}
	</div>
</main>

<footer class="footer">
	<div class="container footer-content">
		<p>NosElus - Données issues de <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer">data.assemblee-nationale.fr</a>, <a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer">data.senat.fr</a> et <a href="https://europarl.europa.eu" target="_blank" rel="noopener noreferrer">europarl.europa.eu</a></p>
		<nav class="footer-links">
			<a href="/mentions-legales">Mentions légales</a>
			<span class="footer-separator">·</span>
			<a href="/politique-de-confidentialite">Politique de confidentialité</a>
			<span class="footer-separator">·</span>
			<a href="/sources">Sources</a>
		</nav>
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

	.footer-content {
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.footer-links {
		margin-top: 0.5rem;
		font-size: 0.8125rem;
	}

	.footer-links a {
		color: var(--color-text-muted);
		text-decoration: none;
	}

	.footer-links a:hover {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.footer-separator {
		margin: 0 0.375rem;
		opacity: 0.5;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	.chamber-nav {
		display: flex;
		gap: 0.25rem;
		flex: 1;
	}

	.chamber-nav a {
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		text-decoration: none;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.chamber-nav a:hover {
		color: var(--color-text);
		background: var(--color-bg);
	}

	.chamber-nav a.active {
		color: var(--color-primary);
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
		font-weight: 500;
	}

	.header-links {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.header-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius);
		color: var(--color-text-muted);
		text-decoration: none;
		transition: all 0.15s;
	}

	.header-link:hover {
		color: var(--color-text);
		background: var(--color-bg);
	}

	.header-link.active {
		color: var(--color-primary);
	}

	.link-label {
		font-size: 0.875rem;
	}

	@media (max-width: 768px) {
		.header-content {
			flex-wrap: wrap;
			gap: 0.75rem;
		}

		.chamber-nav {
			order: 1;
			width: 100%;
			overflow-x: auto;
			padding-bottom: 0.25rem;
			-webkit-overflow-scrolling: touch;
		}

		.chamber-nav a {
			padding: 0.375rem 0.75rem;
			font-size: 0.875rem;
		}

		.link-label {
			display: none;
		}
	}
</style>
