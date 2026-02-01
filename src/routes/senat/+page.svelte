<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// Redirect to /senat/senateurs
	onMount(() => {
		if (browser) {
			goto('/senat/senateurs', { replaceState: true });
		}
	});
</script>

<p>Redirection vers la liste des sénateurs...</p>
