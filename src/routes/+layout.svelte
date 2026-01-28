<script lang="ts">
	import { onMount } from 'svelte';
	import { updated } from '$app/stores';
	import { dev } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// Build timestamp from Vite
	const buildTimestamp = __BUILD_TIMESTAMP__;
	const buildDate = new Date(buildTimestamp);

	// Format the build timestamp
	const formattedDate = buildDate.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
	const formattedTime = buildDate.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit'
	});

	// Check for updates periodically (only in production)
	onMount(() => {
		if (dev) return; // Skip in development mode

		const interval = setInterval(() => {
			updated.check();
		}, 30000); // Check every 30 seconds

		return () => clearInterval(interval);
	});

	function reload() {
		location.reload();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout-wrapper">
	{#if $updated}
		<div class="update-banner">
			<div class="update-content">
				<p>A new version is available!</p>
				<button onclick={reload}>Reload to update</button>
			</div>
		</div>
	{/if}

	<div class="main-content">
		{@render children()}
	</div>

	<footer class="footer">
		<div class="footer-content">
			<p class="build-info">
				Built on {formattedDate} at {formattedTime}
			</p>
		</div>
	</footer>
</div>

<style>
	.layout-wrapper {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.update-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 1rem;
		z-index: 9999;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
		animation: slideDown 0.3s ease-out;
	}

	.update-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.update-content p {
		margin: 0;
		font-weight: 500;
		font-size: 0.95rem;
	}

	.update-content button {
		background: white;
		color: #667eea;
		border: none;
		padding: 0.5rem 1.5rem;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		font-size: 0.9rem;
	}

	.update-content button:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.update-content button:active {
		transform: translateY(0);
	}

	@keyframes slideDown {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@media (max-width: 640px) {
		.update-content {
			flex-direction: column;
			text-align: center;
		}
	}

	.main-content {
		flex: 1;
		padding: 2rem 1rem;
	}

	.footer {
		background: #f8f9fa;
		border-top: 1px solid #e9ecef;
		padding: 1.5rem 1rem;
		margin-top: auto;
	}

	.footer-content {
		max-width: 1200px;
		margin: 0 auto;
		text-align: center;
	}

	.build-info {
		margin: 0;
		font-size: 0.875rem;
		color: #6c757d;
		font-family: 'Courier New', monospace;
	}
</style>
