<script lang="ts">
	import { stack } from 'd3-shape';

	interface MonthData {
		month: string;
		total: number;
		pour: number;
		contre: number;
		abstention: number;
	}

	interface Props {
		data: MonthData[];
		/** Start date of the period (YYYY-MM-DD or YYYY-MM) */
		periodStart?: string | null;
		/** End date of the period (YYYY-MM-DD or YYYY-MM), defaults to current month */
		periodEnd?: string | null;
		maxBars?: number;
		height?: number;
	}

	let { data, periodStart, periodEnd, maxBars = 12, height = 200 }: Props = $props();

	const monthNames = ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

	function formatLabel(monthStr: string): string {
		const monthNum = parseInt(monthStr.slice(5, 7));
		const year = monthStr.slice(2, 4);
		return `${monthNames[monthNum]} ${year}`;
	}

	// Generate nice integer tick values for the Y axis
	function generateYTicks(maxValue: number, targetTicks: number = 4): number[] {
		if (maxValue === 0) return [0, 1];
		if (maxValue <= 1) return [0, 1];

		const roughStep = maxValue / targetTicks;
		const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
		const residual = roughStep / magnitude;

		let niceStep: number;
		if (residual <= 1.5) niceStep = magnitude;
		else if (residual <= 3) niceStep = 2 * magnitude;
		else if (residual <= 7) niceStep = 5 * magnitude;
		else niceStep = 10 * magnitude;

		// Ensure step is at least 1 (no fractions for vote counts)
		niceStep = Math.max(1, Math.round(niceStep));

		const ticks: number[] = [];
		for (let tick = 0; tick <= maxValue; tick += niceStep) {
			ticks.push(Math.round(tick));
		}
		// Add one more tick if we're close to maxValue
		if (ticks[ticks.length - 1] < maxValue) {
			ticks.push(ticks[ticks.length - 1] + niceStep);
		}
		return ticks;
	}

	// Generate all months between two dates (inclusive)
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

	// Convert a date string to YYYY-MM format
	function toYearMonth(dateStr: string): string {
		if (dateStr.length === 7) return dateStr; // Already YYYY-MM
		return dateStr.slice(0, 7); // YYYY-MM-DD -> YYYY-MM
	}

	// Get current month in YYYY-MM format
	function getCurrentMonth(): string {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	}

	// Process data: show all months in the period range, filling zeros where needed
	function processData(
		data: MonthData[],
		maxBars: number,
		periodStart?: string | null,
		periodEnd?: string | null
	): MonthData[] {
		// Create a map of existing data
		const dataMap = new Map((data || []).map(d => [d.month, d]));

		// Determine the range to display
		let startMonth: string;
		let endMonth: string;
		let usePeriodRange = false;

		if (periodStart) {
			// Use provided period bounds - show ALL months in the period
			startMonth = toYearMonth(periodStart);
			endMonth = periodEnd ? toYearMonth(periodEnd) : getCurrentMonth();
			usePeriodRange = true;
		} else if (data?.length) {
			// Fall back to data range, limited by maxBars
			const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
			const monthsWithData = sorted.slice(-maxBars);
			if (monthsWithData.length === 0) return [];
			startMonth = monthsWithData[0].month;
			endMonth = monthsWithData[monthsWithData.length - 1].month;
		} else {
			return [];
		}

		// Generate all months in this range
		const allMonths = generateMonthRange(startMonth, endMonth);

		// If using explicit period range, show all months; otherwise limit to maxBars
		const displayMonths = usePeriodRange ? allMonths : allMonths.slice(-maxBars);

		// Fill in data, using zeros where no data exists
		return displayMonths.map(month => dataMap.get(month) || {
			month,
			total: 0,
			pour: 0,
			contre: 0,
			abstention: 0
		});
	}

	const seriesNames = ['pour', 'contre', 'abstention'] as const;
	const seriesColors: Record<string, string> = {
		pour: 'var(--color-success, #4ade80)',
		contre: 'var(--color-danger, #f87171)',
		abstention: 'var(--color-warning, #fbbf24)'
	};

	const chartData = $derived.by(() => {
		const sliced = processData(data, maxBars, periodStart, periodEnd);

		if (sliced.length === 0) return { sliced: [], stacked: [], maxTotal: 0, yTicks: [0], yMax: 1 };

		const stackFn = stack<MonthData>().keys(seriesNames);
		const stacked = stackFn(sliced);
		const maxTotal = Math.max(...sliced.map(d => d.total), 1);
		const yTicks = generateYTicks(maxTotal);
		const yMax = yTicks[yTicks.length - 1] || maxTotal;

		return { sliced, stacked, maxTotal, yTicks, yMax };
	});
</script>

<div class="chart-wrapper" style="--chart-height: {height}px;">
	{#if chartData.sliced.length > 0}
		<div class="chart-container">
			<div class="axis-y">
				{#each chartData.yTicks as tick}
					<span
						class="y-tick"
						style="bottom: {(tick / chartData.yMax) * 100}%"
					>
						{tick}
					</span>
				{/each}
			</div>
			<div class="chart-area">
				<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="chart-svg">
					<!-- Grid lines -->
					{#each chartData.yTicks as tick}
						{@const y = 100 - (tick / chartData.yMax) * 100}
						<line
							x1="0"
							y1="{y}%"
							x2="100"
							y2="{y}%"
							stroke="var(--color-border, #e5e7eb)"
							stroke-width="0.5"
							vector-effect="non-scaling-stroke"
						/>
					{/each}
					<!-- Bars -->
					{#each chartData.stacked as series}
						{#each series as d, i}
							{@const barWidth = 85 / chartData.sliced.length}
							{@const barX = (i / chartData.sliced.length) * 100 + (100 / chartData.sliced.length - barWidth) / 2}
							{@const y0 = 100 - (d[0] / chartData.yMax) * 100}
							{@const y1 = 100 - (d[1] / chartData.yMax) * 100}
							{@const barHeight = y0 - y1}
							<rect
								x="{barX}%"
								y="{y1}%"
								width="{barWidth}%"
								height="{Math.max(barHeight, 0)}%"
								fill={seriesColors[series.key]}
								rx="1"
							>
								<title>{series.key}: {d[1] - d[0]}</title>
							</rect>
						{/each}
					{/each}
				</svg>
			</div>
		</div>

		<div class="axis-x">
			{#each chartData.sliced as month, i}
				<span
					class="axis-label"
					style="left: {((i + 0.5) / chartData.sliced.length) * 100}%"
				>
					{formatLabel(month.month)}
				</span>
			{/each}
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
		display: flex;
		height: var(--chart-height, 200px);
	}

	.axis-y {
		width: 2.5rem;
		position: relative;
		flex-shrink: 0;
	}

	.y-tick {
		position: absolute;
		right: 0.5rem;
		transform: translateY(50%);
		font-size: 0.65rem;
		color: var(--color-text-muted);
		text-align: right;
	}

	.chart-area {
		flex: 1;
		position: relative;
	}

	.chart-svg {
		width: 100%;
		height: 100%;
	}

	.axis-x {
		position: relative;
		height: 3rem;
		margin-left: 2.5rem;
	}

	.axis-label {
		position: absolute;
		transform: translateX(-50%) rotate(-45deg);
		transform-origin: top center;
		font-size: 0.65rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		text-align: right;
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

	.empty-state {
		color: var(--color-text-muted);
		text-align: center;
		padding: 2rem;
	}
</style>
