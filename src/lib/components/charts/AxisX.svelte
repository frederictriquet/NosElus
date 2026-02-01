<script lang="ts">
	import { getContext } from 'svelte';
	import type { LayerCakeContext } from './types';

	const { width, height, xScale } = getContext<LayerCakeContext>('LayerCake');

	interface Props {
		ticks?: number | unknown[];
		format?: (d: unknown) => string;
		gridlines?: boolean;
		tickMarks?: boolean;
		baseline?: boolean;
		snapLabels?: boolean;
	}

	let {
		ticks = 6,
		format = (d: unknown) => String(d),
		gridlines = false,
		tickMarks = false,
		baseline = true,
		snapLabels = false
	}: Props = $props();

	let tickVals = $derived.by(() => {
		const scale = $xScale as unknown as { ticks?: (n: number) => unknown[]; domain: () => unknown[] };
		if (Array.isArray(ticks)) return ticks;
		if (typeof scale.ticks === 'function') {
			return scale.ticks(ticks as number);
		}
		return scale.domain();
	});

	function textAnchor(i: number, total: number): string {
		if (!snapLabels) return 'middle';
		if (i === 0) return 'start';
		if (i === total - 1) return 'end';
		return 'middle';
	}
</script>

<g class="axis x-axis" class:snapLabels>
	{#if baseline}
		<line class="baseline" y1={$height} y2={$height} x1="0" x2={$width} />
	{/if}

	{#each tickVals as tick, i (i)}
		{@const x = $xScale(tick)}
		<g class="tick tick-{i}" transform="translate({x}, {$height})">
			{#if gridlines}
				<line class="gridline" x1="0" x2="0" y1={0} y2={-$height} />
			{/if}
			{#if tickMarks}
				<line class="tick-mark" x1="0" x2="0" y1="0" y2="6" />
			{/if}
			<text
				x="0"
				y="0"
				dy="16"
				text-anchor={textAnchor(i, tickVals.length)}
				transform="rotate(-45)"
				style="transform-origin: 0 0;"
			>
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
		stroke-dasharray: 2;
	}

	.tick text {
		fill: var(--color-text-muted, #6b7280);
	}

	.baseline {
		stroke: var(--color-border, #e5e7eb);
	}
</style>
