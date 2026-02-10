<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	const navItems = [
		{ href: '/admin', label: 'Positions', exact: true },
		{ href: '/admin/etl-status', label: 'État ETL' },
		{ href: '/admin/law-text-review', label: 'Revue textes de loi' }
	];

	function isActive(href: string, exact: boolean = false): boolean {
		const path = $page.url.pathname;
		return exact ? path === href : path.startsWith(href);
	}
</script>

{#if data.authenticated}
	<div class="admin-shell">
		<div class="admin-topbar">
			<div class="topbar-left">
				<span class="admin-badge">Admin</span>
				<nav class="admin-nav">
					{#each navItems as item}
						<a href={item.href} class="nav-item" class:active={isActive(item.href, item.exact)}>
							{item.label}
						</a>
					{/each}
				</nav>
			</div>
			<form method="POST" action="/admin?/logout" use:enhance>
				<button type="submit" class="btn-logout">Déconnexion</button>
			</form>
		</div>

		{@render children()}
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.admin-shell {
		max-width: 1200px;
		margin: 0 auto;
	}

	.admin-topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.topbar-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.admin-badge {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.5rem;
		background: var(--color-primary);
		color: white;
		border-radius: 4px;
	}

	.admin-nav {
		display: flex;
		gap: 0.25rem;
	}

	.nav-item {
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		text-decoration: none;
		border-radius: 6px;
		transition: all 0.15s;
	}

	.nav-item:hover {
		color: var(--color-text);
		background: var(--color-bg);
	}

	.nav-item.active {
		color: var(--color-primary);
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
	}

	.btn-logout {
		padding: 0.375rem 0.75rem;
		background: var(--color-surface);
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-logout:hover {
		background: var(--color-bg);
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	@media (max-width: 768px) {
		.admin-topbar {
			flex-wrap: wrap;
			gap: 0.75rem;
		}

		.topbar-left {
			flex-wrap: wrap;
			width: 100%;
		}

		.admin-nav {
			overflow-x: auto;
			width: 100%;
			-webkit-overflow-scrolling: touch;
		}

		.nav-item {
			white-space: nowrap;
			padding: 0.375rem 0.625rem;
			font-size: 0.8125rem;
		}
	}
</style>
