<script lang="ts">
	import { LayerCake, Svg, flatten } from 'layercake';
	import { stack } from 'd3-shape';
	import { scaleBand, scaleOrdinal } from 'd3-scale';
	import ColumnStacked from './charts/ColumnStacked.svelte';
	import AxisX from './charts/AxisX.svelte';
	import AxisY from './charts/AxisY.svelte';

	interface GroupData {
		id: string;
		name: string;
		shortName: string | null;
		color: string | null;
		pour: number;
		contre: number;
		abstention: number;
		nonVotant: number;
		total: number;
	}

	interface Props {
		/** Données des votes par groupe */
		groups: GroupData[];
		/** Mode d'affichage */
		mode: 'by-group' | 'by-position';
		/** Hauteur du graphique en pixels */
		height?: number;
		/** Nombre max de groupes à afficher (mode by-group) */
		maxGroups?: number;
	}

	let { groups, mode, height = 250, maxGroups = 10 }: Props = $props();

	// Couleurs pour les positions de vote
	const positionColors = {
		pour: 'var(--color-success, #4ade80)',
		contre: 'var(--color-danger, #f87171)',
		abstention: 'var(--color-warning, #fbbf24)',
		nonVotant: 'var(--color-text-muted, #9ca3af)'
	};

	// Mode by-group: barres = groupes, empilées par position
	const byGroupData = $derived.by(() => {
		if (mode !== 'by-group') return null;

		const sortedGroups = [...groups]
			.sort((a, b) => b.total - a.total)
			.slice(0, maxGroups);

		if (sortedGroups.length === 0) return null;

		const seriesNames = ['pour', 'contre', 'abstention', 'nonVotant'];
		const seriesColors = [positionColors.pour, positionColors.contre, positionColors.abstention, positionColors.nonVotant];

		const dataForStack = sortedGroups.map((g) => ({
			label: g.shortName || g.name.slice(0, 10),
			fullName: g.name,
			pour: g.pour,
			contre: g.contre,
			abstention: g.abstention,
			nonVotant: g.nonVotant,
			total: g.total
		}));

		const stackFn = stack<(typeof dataForStack)[0]>().keys(seriesNames);
		const stacked = stackFn(dataForStack);
		const xDomain = dataForStack.map((d) => d.label);

		return { stacked, xDomain, seriesNames, seriesColors, dataForStack };
	});

	// Mode by-position: barres = positions, empilées par groupe
	const byPositionData = $derived.by(() => {
		if (mode !== 'by-position') return null;

		const sortedGroups = [...groups]
			.sort((a, b) => b.total - a.total)
			.slice(0, maxGroups);

		if (sortedGroups.length === 0) return null;

		// Transformer: une barre par position, empilée par groupe
		const positions = ['Pour', 'Contre', 'Abstention', 'Non-votant'];
		const groupNames = sortedGroups.map((g) => g.shortName || g.id);
		const groupColors = sortedGroups.map((g) => g.color || '#888');

		// Créer les données: chaque position contient les votes de chaque groupe
		const dataForStack = positions.map((pos) => {
			const posKey = pos === 'Non-votant' ? 'nonVotant' : pos.toLowerCase() as 'pour' | 'contre' | 'abstention' | 'nonVotant';
			const row: Record<string, unknown> = { label: pos };
			let total = 0;
			sortedGroups.forEach((g, i) => {
				row[groupNames[i]] = g[posKey];
				total += g[posKey];
			});
			row['total'] = total;
			return row;
		});

		const stackFn = stack<(typeof dataForStack)[0]>().keys(groupNames);
		const stacked = stackFn(dataForStack);
		const xDomain = positions;

		return { stacked, xDomain, seriesNames: groupNames, seriesColors: groupColors, dataForStack, sortedGroups };
	});

	const chartData = $derived(mode === 'by-group' ? byGroupData : byPositionData);
	const hasData = $derived(chartData !== null && chartData.stacked.length > 0);
</script>

<div class="chart-wrapper" style="--chart-height: {height}px;">
	{#if hasData && chartData}
		<div class="chart-container">
			<LayerCake
				padding={{ top: 10, right: 10, bottom: 50, left: 40 }}
				x={(d: { data: { label: string } }) => d.data.label}
				y={[0, 1]}
				z="key"
				xScale={scaleBand().paddingInner(0.2).paddingOuter(0.1).round(true)}
				xDomain={chartData.xDomain}
				xDomainSort={false}
				zScale={scaleOrdinal()}
				zDomain={chartData.seriesNames}
				zRange={chartData.seriesColors}
				flatData={flatten(chartData.stacked)}
				data={chartData.stacked}
			>
				<Svg>
					<AxisY ticks={4} format={(d) => String(d)} integerOnly />
					<AxisX ticks={chartData.xDomain} gridlines />
					<ColumnStacked />
				</Svg>
			</LayerCake>
		</div>

		{#if mode === 'by-group'}
			<div class="legend">
				<span class="legend-item">
					<span class="legend-box" style="background: {positionColors.pour}"></span>
					Pour
				</span>
				<span class="legend-item">
					<span class="legend-box" style="background: {positionColors.contre}"></span>
					Contre
				</span>
				<span class="legend-item">
					<span class="legend-box" style="background: {positionColors.abstention}"></span>
					Abstention
				</span>
				<span class="legend-item">
					<span class="legend-box" style="background: {positionColors.nonVotant}"></span>
					Non-votant
				</span>
			</div>
		{:else if byPositionData}
			<div class="legend legend-groups">
				{#each byPositionData.sortedGroups as group}
					<span class="legend-item">
						<span class="legend-box" style="background: {group.color || '#888'}"></span>
						{group.shortName || group.name.slice(0, 8)}
					</span>
				{/each}
			</div>
		{/if}
	{:else}
		<p class="empty-state">Aucune donnée de vote</p>
	{/if}
</div>

<style>
	.chart-wrapper {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.chart-container {
		width: 100%;
		height: var(--chart-height, 250px);
	}

	.legend {
		display: flex;
		gap: 1.25rem;
		justify-content: center;
		flex-wrap: wrap;
		font-size: 0.8rem;
	}

	.legend-groups {
		gap: 0.75rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--color-text-muted);
	}

	.legend-box {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.empty-state {
		color: var(--color-text-muted);
		text-align: center;
		padding: 2rem;
	}
</style>
