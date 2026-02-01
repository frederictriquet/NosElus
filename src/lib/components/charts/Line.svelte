<script lang="ts">
	import { getContext } from 'svelte';
	import type { LayerCakeContext } from './types';

	const { data, xGet, yGet } = getContext<LayerCakeContext>('LayerCake');

	interface Props {
		stroke?: string;
		strokeWidth?: number;
	}

	let { stroke = 'var(--color-primary, #3b82f6)', strokeWidth = 2 }: Props = $props();

	let path = $derived(
		'M' +
			$data
				.map((d: unknown) => {
					return $xGet(d) + ',' + $yGet(d);
				})
				.join('L')
	);
</script>

<path class="path-line" d={path} {stroke} stroke-width={strokeWidth}></path>

<style>
	.path-line {
		fill: none;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
</style>
