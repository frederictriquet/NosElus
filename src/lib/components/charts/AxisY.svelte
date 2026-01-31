<script lang="ts">
	import { getContext } from 'svelte';
	import type { LayerCakeContext } from './types';

	const { width, yScale } = getContext<LayerCakeContext>('LayerCake');

	interface Props {
		ticks?: number | number[];
		format?: (d: number) => string;
		gridlines?: boolean;
		tickMarks?: boolean;
		integerOnly?: boolean;
	}

	let {
		ticks = 4,
		format = (d: number) => `${d}%`,
		gridlines = true,
		tickMarks = false,
		integerOnly = false
	}: Props = $props();

	let tickVals = $derived.by(() => {
		const scale = $yScale as unknown as { ticks?: (n: number) => number[]; domain: () => number[] };
		let values: number[];

		if (Array.isArray(ticks)) {
			values = ticks;
		} else if (typeof scale.ticks === 'function') {
			values = scale.ticks(ticks);
		} else {
			values = scale.domain();
		}

		// Filter to integers only if requested
		if (integerOnly) {
			values = values.filter(v => Number.isInteger(v));
			// Ensure we have at least 0 and the max
			if (values.length === 0) {
				const domain = scale.domain();
				values = [0, Math.ceil(domain[1] || 1)];
			}
		}

		return values;
	});
</script>

<g class="axis y-axis">
	{#each tickVals as tick, i (tick)}
		{@const y = $yScale(tick)}
		<g class="tick tick-{i}" transform="translate(0, {y})">
			{#if gridlines}
				<line class="gridline" x1="0" x2={$width} y1="0" y2="0" />
			{/if}
			{#if tickMarks}
				<line class="tick-mark" x1="-6" x2="0" y1="0" y2="0" />
			{/if}
			<text x="-8" y="0" dy="0.32em" text-anchor="end">
				{format(tick)}
			</text>
		</g>
	{/each}
</g>

<style>
	.tick {
		font-size: 0.65rem;
	}

	.tick line {
		stroke: var(--color-border, #e5e7eb);
	}

	.tick .gridline {
		stroke-dasharray: 0;
	}

	.tick text {
		fill: var(--color-text-muted, #6b7280);
	}
</style>
