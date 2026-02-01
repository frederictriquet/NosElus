<script lang="ts">
	import { LayerCake, Svg } from 'layercake';
	import { scalePoint } from 'd3-scale';
	import Line from './charts/Line.svelte';
	import AxisX from './charts/AxisX.svelte';
	import AxisY from './charts/AxisY.svelte';
	import HorizontalLine from './charts/HorizontalLine.svelte';
	import Scatter from './charts/Scatter.svelte';

	interface CohesionData {
		month: string;
		cohesion: number;
		scrutinCount: number;
	}

	interface Props {
		data: CohesionData[];
		periodStart?: string | null;
		periodEnd?: string | null;
		height?: number;
	}

	let { data, periodStart, periodEnd, height = 200 }: Props = $props();

	const monthNames = [
		'',
		'jan',
		'fév',
		'mar',
		'avr',
		'mai',
		'jun',
		'jul',
		'aoû',
		'sep',
		'oct',
		'nov',
		'déc'
	];

	function formatLabel(monthStr: string): string {
		const monthNum = parseInt(monthStr.slice(5, 7));
		const year = monthStr.slice(2, 4);
		return `${monthNames[monthNum]} ${year}`;
	}

	function generateMonthRange(startMonth: string, endMonth: string): string[] {
		const result: string[] = [];
		let [year, month] = startMonth.split('-').map(Number);
		const [endYear, endMonthNum] = endMonth.split('-').map(Number);

		while (year < endYear || (year === endYear && month <= endMonthNum)) {
			result.push(`${year}-${String(month).padStart(2, '0')}`);
			month++;
			if (month > 12) {
				month = 1;
				year++;
			}
		}
		return result;
	}

	function toYearMonth(dateStr: string): string {
		if (dateStr.length === 7) return dateStr;
		return dateStr.slice(0, 7);
	}

	function getCurrentMonth(): string {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	}

	function processData(
		data: CohesionData[],
		periodStart?: string | null,
		periodEnd?: string | null
	): CohesionData[] {
		const dataMap = new Map((data || []).map((d) => [d.month, d]));

		let startMonth: string;
		let endMonth: string;

		if (periodStart) {
			startMonth = toYearMonth(periodStart);
			endMonth = periodEnd ? toYearMonth(periodEnd) : getCurrentMonth();
		} else if (data?.length) {
			const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
			startMonth = sorted[0].month;
			endMonth = sorted[sorted.length - 1].month;
		} else {
			return [];
		}

		const allMonths = generateMonthRange(startMonth, endMonth);

		return allMonths.map(
			(month) =>
				dataMap.get(month) || {
					month,
					cohesion: 0,
					scrutinCount: 0
				}
		);
	}

	const chartData = $derived.by(() => {
		const processed = processData(data, periodStart, periodEnd);
		if (processed.length === 0) return { allMonths: [], pointsWithData: [], hasData: false };

		const pointsWithData = processed.filter((d) => d.scrutinCount > 0);
		if (pointsWithData.length === 0)
			return { allMonths: processed, pointsWithData: [], hasData: false };

		const avgCohesion =
			pointsWithData.reduce((sum, d) => sum + d.cohesion, 0) / pointsWithData.length;

		return {
			allMonths: processed,
			pointsWithData,
			avgCohesion,
			hasData: true
		};
	});

	// X domain: all month strings
	const xDomain = $derived(chartData.allMonths.map((d) => d.month));

	// Filter ticks to show max ~12 labels
	const xTicks = $derived.by(() => {
		const months = chartData.allMonths;
		if (months.length <= 12) return months.map((d) => d.month);
		const step = Math.ceil(months.length / 12);
		return months.filter((_, i) => i % step === 0).map((d) => d.month);
	});

	function formatXLabel(d: unknown): string {
		return formatLabel(d as string);
	}

	function formatTooltip(d: unknown): string {
		const item = d as CohesionData;
		return `${formatLabel(item.month)}: ${item.cohesion.toFixed(0)}% (${item.scrutinCount} scrutins)`;
	}
</script>

<div class="chart-wrapper" style="--chart-height: {height}px;">
	{#if chartData.hasData}
		<div class="chart-header">
			<span class="avg-label">
				Cohésion moyenne : <strong>{chartData.avgCohesion?.toFixed(0)}%</strong>
			</span>
		</div>
		<div class="chart-container">
			<LayerCake
				padding={{ top: 10, right: 10, bottom: 40, left: 35 }}
				x="month"
				y="cohesion"
				xScale={scalePoint().padding(0.5)}
				{xDomain}
				yDomain={[0, 100]}
				data={chartData.pointsWithData}
			>
				<Svg>
					<AxisY ticks={[100, 75, 50, 25, 0]} />
					<AxisX ticks={xTicks} format={formatXLabel} gridlines />
					<HorizontalLine y={chartData.avgCohesion || 0} />
					<Line />
					<Scatter r={4} formatTitle={formatTooltip} />
				</Svg>
			</LayerCake>
		</div>

		<p class="chart-description">
			La cohésion mesure le pourcentage de votes alignés au sein du groupe pour chaque scrutin.
		</p>
	{:else}
		<p class="empty-state">Aucune donnée de cohésion</p>
	{/if}
</div>

<style>
	.chart-wrapper {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chart-header {
		display: flex;
		justify-content: flex-end;
		padding-right: 0.5rem;
	}

	.avg-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.avg-label strong {
		color: var(--color-primary);
	}

	.chart-container {
		width: 100%;
		height: var(--chart-height, 200px);
	}

	.chart-description {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		text-align: center;
		margin: 0;
	}

	.empty-state {
		color: var(--color-text-muted);
		text-align: center;
		padding: 2rem;
	}
</style>
