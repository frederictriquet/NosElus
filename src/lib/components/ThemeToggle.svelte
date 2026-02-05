<script lang="ts">
	import { browser } from '$app/environment';

	type Theme = 'light' | 'dark' | 'high-contrast' | 'system';

	let theme: Theme = $state('system');

	// Initialize theme from localStorage on mount
	$effect(() => {
		if (browser) {
			const stored = localStorage.getItem('theme') as Theme | null;
			if (stored && ['light', 'dark', 'high-contrast', 'system'].includes(stored)) {
				theme = stored;
			}
			applyTheme(theme);
		}
	});

	function applyTheme(t: Theme) {
		if (!browser) return;

		const root = document.documentElement;
		root.removeAttribute('data-theme');

		if (t === 'system') {
			// Let the CSS media query handle it
			return;
		}

		root.setAttribute('data-theme', t);
	}

	function cycleTheme() {
		const order: Theme[] = ['light', 'dark', 'high-contrast', 'system'];
		const currentIndex = order.indexOf(theme);
		const nextIndex = (currentIndex + 1) % order.length;
		theme = order[nextIndex];
		localStorage.setItem('theme', theme);
		applyTheme(theme);
	}

	const icon = $derived.by(() => {
		switch (theme) {
			case 'light':
				return 'sun';
			case 'dark':
				return 'moon';
			case 'high-contrast':
				return 'contrast';
			default:
				return 'system';
		}
	});

	const label = $derived.by(() => {
		switch (theme) {
			case 'light':
				return 'Clair';
			case 'dark':
				return 'Sombre';
			case 'high-contrast':
				return 'Contraste';
			default:
				return 'Auto';
		}
	});
</script>

<button class="theme-toggle" onclick={cycleTheme} title="Thème: {label}">
	{#if icon === 'sun'}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="4"></circle>
			<path d="M12 2v2"></path>
			<path d="M12 20v2"></path>
			<path d="m4.93 4.93 1.41 1.41"></path>
			<path d="m17.66 17.66 1.41 1.41"></path>
			<path d="M2 12h2"></path>
			<path d="M20 12h2"></path>
			<path d="m6.34 17.66-1.41 1.41"></path>
			<path d="m19.07 4.93-1.41 1.41"></path>
		</svg>
	{:else if icon === 'moon'}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
		</svg>
	{:else if icon === 'contrast'}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="10"></circle>
			<path d="M12 2v20" fill="currentColor"></path>
			<path d="M12 2a10 10 0 0 1 0 20" fill="currentColor"></path>
		</svg>
	{:else}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
			<line x1="8" y1="21" x2="16" y2="21"></line>
			<line x1="12" y1="17" x2="12" y2="21"></line>
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: var(--radius);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.theme-toggle:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}
</style>
