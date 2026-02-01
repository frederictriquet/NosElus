<script lang="ts">
	import { getContext } from 'svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data, xGet, yGet } = getContext<any>('LayerCake');

	interface Props {
		r?: number;
		fill?: string;
		formatTitle?: (d: unknown) => string;
	}

	let { r = 4, fill = 'var(--color-primary, #3b82f6)', formatTitle = () => '' }: Props = $props();
</script>

<g class="scatter-group">
	{#each $data as d, i (i)}
		<circle cx={$xGet(d)} cy={$yGet(d)} {r} {fill}>
			{#if formatTitle(d)}
				<title>{formatTitle(d)}</title>
			{/if}
		</circle>
	{/each}
</g>

<style>
	circle {
		cursor: help;
	}
</style>
