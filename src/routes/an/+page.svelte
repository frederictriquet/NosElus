<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// Redirect to /an/deputes
	onMount(() => {
		if (browser) {
			goto('/an/deputes', { replaceState: true });
		}
	});
</script>

<p>Redirection vers la liste des députés...</p>
