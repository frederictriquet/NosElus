<script lang="ts">
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

	const monthNames = ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

	function formatLabel(monthStr: string): string {
		const monthNum = parseInt(monthStr.slice(5, 7));
		const year = monthStr.slice(2, 4);
		return `${monthNames[monthNum]} ${year}`;
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

	function toYearMonth(dateStr: string): string {
		if (dateStr.length === 7) return dateStr;
		return dateStr.slice(0, 7);
	}

	function getCurrentMonth(): string {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	}

	// Process data to fill gaps
	function processData(data: CohesionData[], periodStart?: string | null, periodEnd?: string | null): CohesionData[] {
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
		if (processed.length === 0) return { points: [], hasData: false };

		// Filter months with actual data for the line
		const pointsWithData = processed.filter((d) => d.scrutinCount > 0);
		if (pointsWithData.length === 0) return { points: [], hasData: false };

		// Calculate average cohesion
		const avgCohesion =
			pointsWithData.reduce((sum, d) => sum + d.cohesion, 0) / pointsWithData.length;

		return {
			processed,
			pointsWithData,
			avgCohesion,
			hasData: true
		};
	});

	// SVG path for the line
	const linePath = $derived.by(() => {
		if (!chartData.hasData || !chartData.pointsWithData) return '';

		const points = chartData.pointsWithData;
		const processed = chartData.processed!;

		// Map month to x position
		const monthToX = new Map(processed.map((d, i) => [d.month, (i + 0.5) / processed.length * 100]));

		return points
			.map((point, i) => {
				const x = monthToX.get(point.month) || 0;
				const y = 100 - point.cohesion; // Invert Y (0 at top)
				return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
			})
			.join(' ');
	});
</script>

<div class="chart-wrapper" style="--chart-height: {height}px;">
	{#if chartData.hasData}
		<div class="chart-header">
			<span class="avg-label">
				Cohésion moyenne : <strong>{chartData.avgCohesion?.toFixed(0)}%</strong>
			</span>
		</div>
		<div class="chart-container">
			<div class="axis-y">
				{#each [100, 75, 50] as tick}
					<span class="y-tick" style="bottom: {tick * 0.95}%">{tick}%</span>
				{/each}
			</div>
			<div class="chart-area">
				<!-- viewBox with 5% top padding for circles at 100% cohesion -->
				<svg viewBox="0 -5 100 105" preserveAspectRatio="none" class="chart-svg">
					<!-- Grid lines -->
					{#each [100, 75, 50] as tick}
						{@const y = 100 - tick}
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
					<!-- Average line -->
					<line
						x1="0"
						y1="{100 - (chartData.avgCohesion || 0)}%"
						x2="100"
						y2="{100 - (chartData.avgCohesion || 0)}%"
						stroke="var(--color-primary, #3b82f6)"
						stroke-width="1"
						stroke-dasharray="4 2"
						vector-effect="non-scaling-stroke"
						opacity="0.5"
					/>
					<!-- Cohesion line -->
					<path
						d={linePath}
						fill="none"
						stroke="var(--color-primary, #3b82f6)"
						stroke-width="2"
						vector-effect="non-scaling-stroke"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
				</svg>
				<!-- Data points as positioned divs to maintain aspect ratio -->
				{#each chartData.pointsWithData || [] as point}
					{@const processed = chartData.processed || []}
					{@const monthIndex = processed.findIndex((d) => d.month === point.month)}
					{@const x = (monthIndex + 0.5) / processed.length * 100}
					{@const y = (100 - point.cohesion) * 0.95 + 2.5}
					<div
						class="data-point"
						style="left: {x}%; top: {y}%;"
						title="{formatLabel(point.month)}: {point.cohesion.toFixed(0)}% ({point.scrutinCount} scrutins)"
					></div>
				{/each}
			</div>
		</div>

		<div class="axis-x">
			{#each chartData.processed || [] as month, i}
				{#if i % Math.ceil((chartData.processed?.length || 1) / 12) === 0}
					<span
						class="axis-label"
						style="left: {((i + 0.5) / (chartData.processed?.length || 1)) * 100}%"
					>
						{formatLabel(month.month)}
					</span>
				{/if}
			{/each}
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
		display: flex;
		height: var(--chart-height, 200px);
	}

	.axis-y {
		width: 3rem;
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
		height: 2.5rem;
		margin-left: 3rem;
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

	.data-point {
		position: absolute;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-primary, #3b82f6);
		transform: translate(-50%, -50%);
		cursor: help;
	}
</style>
