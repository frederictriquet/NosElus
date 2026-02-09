import { describe, it, expect } from 'vitest';
import { formatLegislature, percentage, coverageClass } from './+page.helpers';

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
