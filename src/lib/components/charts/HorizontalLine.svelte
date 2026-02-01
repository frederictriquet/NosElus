<script lang="ts">
	import { getContext } from 'svelte';
	import type { LayerCakeContext } from './types';

	const { width, yScale } = getContext<LayerCakeContext>('LayerCake');

	interface Props {
		y: number;
		stroke?: string;
		strokeWidth?: number;
		strokeDasharray?: string;
		opacity?: number;
	}

	let {
		y,
		stroke = 'var(--color-primary, #3b82f6)',
		strokeWidth = 1,
		strokeDasharray = '4 2',
		opacity = 0.5
	}: Props = $props();
</script>

<line
	x1="0"
	x2={$width}
	y1={$yScale(y)}
	y2={$yScale(y)}
	{stroke}
	stroke-width={strokeWidth}
	stroke-dasharray={strokeDasharray}
	{opacity}
/>
