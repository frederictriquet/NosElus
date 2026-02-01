<script lang="ts">
	import { getContext } from 'svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data, xGet, yGet, zGet, xScale } = getContext<any>('LayerCake');

	interface Props {
		rx?: number;
	}

	let { rx = 1 }: Props = $props();
</script>

<g class="column-group">
	{#each $data as series, i}
		{#each series as d}
			{@const yVals = $yGet(d)}
			{@const columnHeight = Math.max(0, yVals[0] - yVals[1])}
			{@const bandwidth = typeof $xScale.bandwidth === 'function' ? $xScale.bandwidth() : 10}
			<rect
				class="group-rect"
				data-id={i}
				x={$xGet(d)}
				y={yVals[1]}
				width={bandwidth}
				height={columnHeight}
				fill={$zGet(series)}
				{rx}
			>
				<title>{series.key}: {d[1] - d[0]}</title>
			</rect>
		{/each}
	{/each}
</g>
