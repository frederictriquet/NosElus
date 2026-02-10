import { describe, it, expect } from 'vitest';
import {
	formatLegislature,
	percentage,
	coverageClass,
	extractLegislatureNumber,
	sortLegislatureStats
} from './page.helpers';
import type { LegislatureStats } from './+page.server';

describe('formatLegislature', () => {
	describe('Assemblée Nationale', () => {
		it('should format AN legislature correctly', () => {
			expect(formatLegislature('17')).toBe('17e législature');
			expect(formatLegislature('16')).toBe('16e législature');
			expect(formatLegislature('15')).toBe('15e législature');
		});

		it('should handle single digit legislatures', () => {
			expect(formatLegislature('1')).toBe('1e législature');
			expect(formatLegislature('7')).toBe('7e législature');
		});
	});

	describe('Parlement Européen', () => {
		it('should format PE terme correctly', () => {
			expect(formatLegislature('PE-10')).toBe('10e terme');
			expect(formatLegislature('PE-9')).toBe('9e terme');
			expect(formatLegislature('PE-8')).toBe('8e terme');
		});

		it('should handle single digit termes', () => {
			expect(formatLegislature('PE-1')).toBe('1e terme');
		});
	});

	describe('Sénat', () => {
		it('should format SE renouvellement correctly', () => {
			expect(formatLegislature('SE-2023')).toBe('Renouvellement 2023');
			expect(formatLegislature('SE-2020')).toBe('Renouvellement 2020');
			expect(formatLegislature('SE-2017')).toBe('Renouvellement 2017');
		});
	});

	describe('Edge cases', () => {
		it('should handle empty strings', () => {
			expect(formatLegislature('')).toBe('e législature');
		});

		it('should handle malformed IDs gracefully', () => {
			expect(formatLegislature('INVALID')).toBe('INVALIDe législature');
		});

		it('should handle prefix without number', () => {
			expect(formatLegislature('PE-')).toBe('e terme');
			expect(formatLegislature('SE-')).toBe('Renouvellement ');
		});

		it('should not match prefix without hyphen', () => {
			// "PE10" sans tiret ne doit PAS être traité comme PE
			expect(formatLegislature('PE10')).toBe('PE10e législature');
			expect(formatLegislature('SE2023')).toBe('SE2023e législature');
		});
	});
});

describe('percentage', () => {
	describe('Normal cases', () => {
		it('should calculate percentage correctly', () => {
			expect(percentage(50, 100)).toBe(50);
			expect(percentage(25, 100)).toBe(25);
			expect(percentage(75, 100)).toBe(75);
		});

		it('should handle fractional results', () => {
			expect(percentage(1, 3)).toBeCloseTo(33.333, 2);
			expect(percentage(2, 3)).toBeCloseTo(66.666, 2);
		});

		it('should handle 100% correctly', () => {
			expect(percentage(100, 100)).toBe(100);
			expect(percentage(50, 50)).toBe(100);
		});

		it('should handle 0% correctly', () => {
			expect(percentage(0, 100)).toBe(0);
			expect(percentage(0, 50)).toBe(0);
		});
	});

	describe('Edge cases', () => {
		it('should return 0 when total is 0 (avoid division by zero)', () => {
			expect(percentage(10, 0)).toBe(0);
			expect(percentage(0, 0)).toBe(0);
		});

		it('should return 0 when total is negative (defensive)', () => {
			expect(percentage(50, -1)).toBe(0);
			expect(percentage(0, -100)).toBe(0);
		});

		it('should handle very small values', () => {
			expect(percentage(1, 1000)).toBe(0.1);
			expect(percentage(1, 10000)).toBe(0.01);
		});

		it('should handle large values', () => {
			expect(percentage(1000, 1000)).toBe(100);
			expect(percentage(999, 1000)).toBe(99.9);
		});

		it('should allow values > total (for anomaly cases)', () => {
			// Dans certains cas, value peut être > total (anomalie de données)
			expect(percentage(110, 100)).toBeCloseTo(110, 1);
		});
	});

	describe('Type coercion', () => {
		it('should handle integer inputs', () => {
			expect(percentage(50, 100)).toBe(50);
		});

		it('should handle float inputs', () => {
			expect(percentage(50.5, 100)).toBe(50.5);
			expect(percentage(33.33, 100)).toBe(33.33);
		});
	});
});

describe('coverageClass', () => {
	describe('High coverage (>75%)', () => {
		it('should return coverage-high for values > 75', () => {
			expect(coverageClass(76)).toBe('coverage-high');
			expect(coverageClass(80)).toBe('coverage-high');
			expect(coverageClass(90)).toBe('coverage-high');
			expect(coverageClass(100)).toBe('coverage-high');
		});
	});

	describe('Medium coverage (25-75%)', () => {
		it('should return coverage-medium for values between 25 and 75', () => {
			expect(coverageClass(26)).toBe('coverage-medium');
			expect(coverageClass(50)).toBe('coverage-medium');
			expect(coverageClass(75)).toBe('coverage-medium');
		});
	});

	describe('Low coverage (<25%)', () => {
		it('should return coverage-low for values <= 25', () => {
			expect(coverageClass(0)).toBe('coverage-low');
			expect(coverageClass(10)).toBe('coverage-low');
			expect(coverageClass(25)).toBe('coverage-low');
		});
	});

	describe('Boundaries', () => {
		it('should handle exact boundary values correctly', () => {
			expect(coverageClass(25)).toBe('coverage-low'); // ≤25
			expect(coverageClass(25.1)).toBe('coverage-medium'); // >25
			expect(coverageClass(75)).toBe('coverage-medium'); // ≤75
			expect(coverageClass(75.1)).toBe('coverage-high'); // >75
		});
	});

	describe('Edge cases', () => {
		it('should handle values > 100% (data anomalies)', () => {
			expect(coverageClass(110)).toBe('coverage-high');
			expect(coverageClass(150)).toBe('coverage-high');
		});

		it('should handle negative values (defensive)', () => {
			expect(coverageClass(-10)).toBe('coverage-low');
			expect(coverageClass(-0.1)).toBe('coverage-low');
		});
	});
});

describe('Integration: percentage + coverageClass', () => {
	it('should correctly classify real-world scenarios', () => {
		// Très bonne couverture
		const highPct = percentage(950, 1000);
		expect(coverageClass(highPct)).toBe('coverage-high');

		// Couverture moyenne
		const mediumPct = percentage(500, 1000);
		expect(coverageClass(mediumPct)).toBe('coverage-medium');

		// Faible couverture
		const lowPct = percentage(100, 1000);
		expect(coverageClass(lowPct)).toBe('coverage-low');
	});

	it('should handle edge case: no data', () => {
		const pct = percentage(0, 0); // Division par zéro → 0
		expect(coverageClass(pct)).toBe('coverage-low');
	});

	it('should handle edge case: perfect coverage', () => {
		const pct = percentage(1000, 1000);
		expect(coverageClass(pct)).toBe('coverage-high');
	});
});

describe('extractLegislatureNumber', () => {
	it('should extract number from AN legislature', () => {
		expect(extractLegislatureNumber('17')).toBe(17);
		expect(extractLegislatureNumber('1')).toBe(1);
		expect(extractLegislatureNumber('16')).toBe(16);
	});

	it('should extract number from PE legislature', () => {
		expect(extractLegislatureNumber('PE-10')).toBe(10);
		expect(extractLegislatureNumber('PE-9')).toBe(9);
		expect(extractLegislatureNumber('PE-1')).toBe(1);
	});

	it('should extract number from SE legislature', () => {
		expect(extractLegislatureNumber('SE-2023')).toBe(2023);
		expect(extractLegislatureNumber('SE-2020')).toBe(2020);
	});

	it('should return 0 for strings without numbers', () => {
		expect(extractLegislatureNumber('')).toBe(0);
		expect(extractLegislatureNumber('abc')).toBe(0);
	});
});

describe('sortLegislatureStats', () => {
	const makeStat = (overrides: Partial<LegislatureStats> = {}): LegislatureStats => ({
		legislature: '1',
		chamber: 'AN',
		totalLaws: 100,
		lawsWithVotes: 0,
		lawsWithSummaries: 0,
		lawsWithTags: 0,
		lawsWithDescription: 0,
		totalScrutins: 0,
		...overrides
	});

	const testData = [
		makeStat({
			legislature: '17',
			totalLaws: 100,
			lawsWithVotes: 80,
			lawsWithSummaries: 90,
			lawsWithTags: 70,
			lawsWithDescription: 60,
			totalScrutins: 50
		}),
		makeStat({
			legislature: '1',
			totalLaws: 50,
			lawsWithVotes: 10,
			lawsWithSummaries: 5,
			lawsWithTags: 40,
			lawsWithDescription: 45,
			totalScrutins: 200
		}),
		makeStat({
			legislature: '10',
			totalLaws: 200,
			lawsWithVotes: 150,
			lawsWithSummaries: 20,
			lawsWithTags: 10,
			lawsWithDescription: 30,
			totalScrutins: 10
		}),
		makeStat({
			legislature: '2',
			totalLaws: 75,
			lawsWithVotes: 30,
			lawsWithSummaries: 50,
			lawsWithTags: 25,
			lawsWithDescription: 15,
			totalScrutins: 100
		})
	];

	it('should sort by legislature in natural order (asc)', () => {
		const result = sortLegislatureStats(testData, 'legislature', 'asc');
		expect(result.map((r) => r.legislature)).toEqual(['1', '2', '10', '17']);
	});

	it('should sort by legislature in natural order (desc)', () => {
		const result = sortLegislatureStats(testData, 'legislature', 'desc');
		expect(result.map((r) => r.legislature)).toEqual(['17', '10', '2', '1']);
	});

	it('should sort by totalLaws', () => {
		const result = sortLegislatureStats(testData, 'totalLaws', 'asc');
		expect(result.map((r) => r.totalLaws)).toEqual([50, 75, 100, 200]);
	});

	it('should sort by votes percentage', () => {
		const result = sortLegislatureStats(testData, 'votes', 'asc');
		// 1: 10/50=20%, 2: 30/75=40%, 10: 150/200=75%, 17: 80/100=80%
		expect(result.map((r) => r.legislature)).toEqual(['1', '2', '10', '17']);
	});

	it('should sort by ai percentage', () => {
		const result = sortLegislatureStats(testData, 'ai', 'asc');
		// 10: 20/200=10%, 1: 5/50=10% (equal), 2: 50/75=66.7%, 17: 90/100=90%
		const legislatures = result.map((r) => r.legislature);
		// Les deux premiers ont le même pourcentage (10%), ordre entre eux non garanti
		expect(new Set(legislatures.slice(0, 2))).toEqual(new Set(['1', '10']));
		expect(legislatures.slice(2)).toEqual(['2', '17']);
	});

	it('should sort by tags percentage', () => {
		const result = sortLegislatureStats(testData, 'tags', 'asc');
		// 10: 10/200=5%, 2: 25/75=33.3%, 17: 70/100=70%, 1: 40/50=80%
		expect(result.map((r) => r.legislature)).toEqual(['10', '2', '17', '1']);
	});

	it('should sort by description percentage', () => {
		const result = sortLegislatureStats(testData, 'description', 'asc');
		// 10: 30/200=15%, 2: 15/75=20%, 17: 60/100=60%, 1: 45/50=90%
		expect(result.map((r) => r.legislature)).toEqual(['10', '2', '17', '1']);
	});

	it('should sort by scrutins', () => {
		const result = sortLegislatureStats(testData, 'scrutins', 'asc');
		// 10: 10, 17: 50, 2: 100, 1: 200
		expect(result.map((r) => r.legislature)).toEqual(['10', '17', '2', '1']);
	});

	it('should not mutate the original array', () => {
		const original = [...testData];
		sortLegislatureStats(testData, 'legislature', 'asc');
		expect(testData).toEqual(original);
	});
});
