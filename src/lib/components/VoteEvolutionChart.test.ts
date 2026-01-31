import { describe, it, expect } from 'vitest';

interface MonthData {
	month: string;
	total: number;
	pour: number;
	contre: number;
	abstention: number;
}

// Copy of the functions from VoteEvolutionChart.svelte for testing
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

function processData(
	data: MonthData[],
	maxBars: number,
	periodStart?: string | null,
	periodEnd?: string | null
): MonthData[] {
	const dataMap = new Map((data || []).map((d) => [d.month, d]));

	let startMonth: string;
	let endMonth: string;
	let usePeriodRange = false;

	if (periodStart) {
		startMonth = toYearMonth(periodStart);
		endMonth = periodEnd ? toYearMonth(periodEnd) : '2025-01';
		usePeriodRange = true;
	} else if (data?.length) {
		const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
		const monthsWithData = sorted.slice(-maxBars);
		if (monthsWithData.length === 0) return [];
		startMonth = monthsWithData[0].month;
		endMonth = monthsWithData[monthsWithData.length - 1].month;
	} else {
		return [];
	}

	const allMonths = generateMonthRange(startMonth, endMonth);
	const displayMonths = usePeriodRange ? allMonths : allMonths.slice(-maxBars);

	return displayMonths.map(
		(month) =>
			dataMap.get(month) || {
				month,
				total: 0,
				pour: 0,
				contre: 0,
				abstention: 0
			}
	);
}

describe('VoteEvolutionChart data processing', () => {
	describe('processData', () => {
		it('should preserve total vote count when period is specified', () => {
			const inputData: MonthData[] = [
				{ month: '2022-07', total: 50, pour: 30, contre: 15, abstention: 5 },
				{ month: '2022-09', total: 100, pour: 60, contre: 30, abstention: 10 },
				{ month: '2023-01', total: 75, pour: 40, contre: 25, abstention: 10 }
			];

			const inputTotal = inputData.reduce((sum, d) => sum + d.total, 0);
			const inputPour = inputData.reduce((sum, d) => sum + d.pour, 0);
			const inputContre = inputData.reduce((sum, d) => sum + d.contre, 0);
			const inputAbstention = inputData.reduce((sum, d) => sum + d.abstention, 0);

			const result = processData(inputData, 12, '2022-06', '2023-06');

			const resultTotal = result.reduce((sum, d) => sum + d.total, 0);
			const resultPour = result.reduce((sum, d) => sum + d.pour, 0);
			const resultContre = result.reduce((sum, d) => sum + d.contre, 0);
			const resultAbstention = result.reduce((sum, d) => sum + d.abstention, 0);

			expect(resultTotal).toBe(inputTotal);
			expect(resultPour).toBe(inputPour);
			expect(resultContre).toBe(inputContre);
			expect(resultAbstention).toBe(inputAbstention);
		});

		it('should preserve total vote count without period', () => {
			const inputData: MonthData[] = [
				{ month: '2024-01', total: 50, pour: 30, contre: 15, abstention: 5 },
				{ month: '2024-02', total: 100, pour: 60, contre: 30, abstention: 10 },
				{ month: '2024-03', total: 75, pour: 40, contre: 25, abstention: 10 }
			];

			const inputTotal = inputData.reduce((sum, d) => sum + d.total, 0);

			const result = processData(inputData, 12);

			const resultTotal = result.reduce((sum, d) => sum + d.total, 0);
			expect(resultTotal).toBe(inputTotal);
		});

		it('should include all months with data when period spans longer than maxBars', () => {
			// Simulate legislature 16: June 2022 to July 2024 (26 months)
			// Votes only in early months
			const inputData: MonthData[] = [
				{ month: '2022-07', total: 100, pour: 60, contre: 30, abstention: 10 },
				{ month: '2022-08', total: 80, pour: 50, contre: 20, abstention: 10 },
				{ month: '2022-09', total: 60, pour: 40, contre: 15, abstention: 5 }
			];

			const inputTotal = inputData.reduce((sum, d) => sum + d.total, 0);

			// With period specified, should show all months and preserve totals
			const result = processData(inputData, 12, '2022-06', '2024-07');

			const resultTotal = result.reduce((sum, d) => sum + d.total, 0);
			expect(resultTotal).toBe(inputTotal);

			// Should include the months with data
			const monthsWithVotes = result.filter((d) => d.total > 0);
			expect(monthsWithVotes.length).toBe(3);
		});

		it('should fill gaps with zero values', () => {
			const inputData: MonthData[] = [
				{ month: '2024-01', total: 50, pour: 30, contre: 15, abstention: 5 },
				{ month: '2024-03', total: 75, pour: 40, contre: 25, abstention: 10 }
			];

			const result = processData(inputData, 12, '2024-01', '2024-03');

			expect(result.length).toBe(3);
			expect(result[0].month).toBe('2024-01');
			expect(result[1].month).toBe('2024-02');
			expect(result[2].month).toBe('2024-03');

			// Gap month should have zero values
			expect(result[1].total).toBe(0);
			expect(result[1].pour).toBe(0);
		});

		it('should generate correct month range', () => {
			const range = generateMonthRange('2024-10', '2025-02');
			expect(range).toEqual(['2024-10', '2024-11', '2024-12', '2025-01', '2025-02']);
		});

		it('should handle empty data with period', () => {
			const result = processData([], 12, '2024-01', '2024-03');

			expect(result.length).toBe(3);
			expect(result.every((d) => d.total === 0)).toBe(true);
		});

		it('should handle empty data without period', () => {
			const result = processData([], 12);
			expect(result.length).toBe(0);
		});
	});
});
