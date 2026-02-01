<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// Redirect to /pe/eurodeputes
	onMount(() => {
		if (browser) {
			goto('/pe/eurodeputes', { replaceState: true });
		}
	});
</script>

<p>Redirection vers la liste des eurodéputés...</p>
