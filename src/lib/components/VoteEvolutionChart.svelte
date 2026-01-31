<script lang="ts">
	import { LayerCake, Svg, flatten } from 'layercake';
	import { stack } from 'd3-shape';
	import { scaleBand, scaleOrdinal } from 'd3-scale';
	import ColumnStacked from './charts/ColumnStacked.svelte';
	import AxisX from './charts/AxisX.svelte';
	import AxisY from './charts/AxisY.svelte';

	interface MonthData {
		month: string;
		total: number;
		pour: number;
		contre: number;
		abstention: number;
		nonVotant?: number;
	}

	interface Props {
		data: MonthData[];
		periodStart?: string | null;
		periodEnd?: string | null;
		maxBars?: number;
		height?: number;
	}

	let { data, periodStart, periodEnd, maxBars = 12, height = 200 }: Props = $props();

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

	function formatXLabel(d: unknown): string {
		return formatLabel(d as string);
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
		data: MonthData[],
		maxBars: number,
		periodStart?: string | null,
		periodEnd?: string | null
	): MonthData[] {
		const dataMap = new Map((data || []).map((d) => [d.month, d]));

		// If explicit period is provided, fill all months in range
		if (periodStart) {
			const startMonth = toYearMonth(periodStart);
			const endMonth = periodEnd ? toYearMonth(periodEnd) : getCurrentMonth();
			const allMonths = generateMonthRange(startMonth, endMonth);

			return allMonths.map((month) => {
				const existing = dataMap.get(month);
				return {
					month,
					total: existing?.total ?? 0,
					pour: existing?.pour ?? 0,
					contre: existing?.contre ?? 0,
					abstention: existing?.abstention ?? 0,
					nonVotant: existing?.nonVotant ?? 0
				};
			});
		}

		// No period specified: show only months with actual data (no gap filling)
		if (!data?.length) return [];

		const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
		const monthsToShow = sorted.slice(-maxBars);

		return monthsToShow.map((d) => ({
			month: d.month,
			total: d.total ?? 0,
			pour: d.pour ?? 0,
			contre: d.contre ?? 0,
			abstention: d.abstention ?? 0,
			nonVotant: d.nonVotant ?? 0
		}));
	}

	const seriesNames: string[] = ['pour', 'contre', 'abstention', 'nonVotant'];
	const seriesColors = [
		'var(--color-success, #4ade80)',
		'var(--color-danger, #f87171)',
		'var(--color-warning, #fbbf24)',
		'var(--color-text-muted, #9ca3af)'
	];

	const chartData = $derived.by(() => {
		const sliced = processData(data, maxBars, periodStart, periodEnd);
		if (sliced.length === 0) return { sliced: [], stacked: [], maxTotal: 0, hasData: false };

		const stackFn = stack<MonthData>().keys(seriesNames as Iterable<string>);
		const stacked = stackFn(sliced);
		const maxTotal = Math.max(...sliced.map((d) => d.total), 1);

		return { sliced, stacked, maxTotal, hasData: true };
	});

	const xDomain = $derived(chartData.sliced.map((d) => d.month));
</script>

<div class="chart-wrapper" style="--chart-height: {height}px;">
	{#if chartData.hasData}
		<div class="chart-container">
			<LayerCake
				padding={{ top: 5, right: 5, bottom: 45, left: 30 }}
				x={(d: { data: MonthData }) => d.data.month}
				y={[0, 1]}
				z="key"
				xScale={scaleBand().paddingInner(0.15).paddingOuter(0.1).round(true)}
				{xDomain}
				xDomainSort={false}
				zScale={scaleOrdinal()}
				zDomain={seriesNames}
				zRange={seriesColors}
				flatData={flatten(chartData.stacked)}
				data={chartData.stacked}
			>
				<Svg>
					<AxisY ticks={4} format={(d) => String(d)} integerOnly />
					<AxisX ticks={xDomain} format={formatXLabel} gridlines />
					<ColumnStacked />
				</Svg>
			</LayerCake>
		</div>

		<div class="legend">
			<span class="legend-item">
				<span class="legend-box pour"></span>
				Pour
			</span>
			<span class="legend-item">
				<span class="legend-box contre"></span>
				Contre
			</span>
			<span class="legend-item">
				<span class="legend-box abstention"></span>
				Abstention
			</span>
			<span class="legend-item">
				<span class="legend-box nonvotant"></span>
				Non-votant
			</span>
		</div>
	{:else}
		<p class="empty-state">Aucune donnée d'évolution</p>
	{/if}
</div>

<style>
	.chart-wrapper {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chart-container {
		width: 100%;
		height: var(--chart-height, 200px);
	}

	.legend {
		display: flex;
		gap: 1.5rem;
		justify-content: center;
		font-size: 0.8rem;
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
	}

	.legend-box.pour {
		background: var(--color-success, #4ade80);
	}

	.legend-box.contre {
		background: var(--color-danger, #f87171);
	}

	.legend-box.abstention {
		background: var(--color-warning, #fbbf24);
	}

	.legend-box.nonvotant {
		background: var(--color-text-muted, #9ca3af);
	}

	.empty-state {
		color: var(--color-text-muted);
		text-align: center;
		padding: 2rem;
	}
</style>
