import { describe, it, expect } from 'vitest';
import { extractTermFromReference, generateLawId } from '../shared';

/**
 * Tests unitaires pour le module shared.ts (fonctions partagées PE ETL).
 *
 * Ce module centralise la génération des IDs de lois PE pour garantir
 * la cohérence entre votes.ts et laws.ts.
 */

describe('extractTermFromReference', () => {
	describe('valid references', () => {
		it('should extract term 9 from A9-* reference', () => {
			expect(extractTermFromReference('A9-0045/2024')).toBe(9);
		});

		it('should extract term 10 from A10-* reference', () => {
			expect(extractTermFromReference('A10-0084/2025')).toBe(10);
		});

		it('should extract term 9 from B9-* reference', () => {
			expect(extractTermFromReference('B9-0063/2026')).toBe(9);
		});

		it('should extract term 10 from B10-* reference', () => {
			expect(extractTermFromReference('B10-0071/2026')).toBe(10);
		});

		it('should extract term 9 from C9-* reference', () => {
			expect(extractTermFromReference('C9-0211/2020')).toBe(9);
		});

		it('should extract term 10 from C10-* reference', () => {
			expect(extractTermFromReference('C10-0263/2025')).toBe(10);
		});
	});

	describe('complex references', () => {
		it('should extract term from RC-B10-* reference (composite)', () => {
			// RC-B est un préfixe, B10 contient le terme
			expect(extractTermFromReference('RC-B10-0071/2026')).toBe(10);
		});

		it('should handle references with multiple slashes', () => {
			expect(extractTermFromReference('A9-0048/2022/REV')).toBe(9);
		});

		it('should handle references without year', () => {
			expect(extractTermFromReference('A10-0215')).toBe(10);
		});
	});

	describe('invalid or non-matching references', () => {
		it('should return null for reference without term pattern', () => {
			expect(extractTermFromReference('2024/1234')).toBeNull();
		});

		it('should return null for empty string', () => {
			expect(extractTermFromReference('')).toBeNull();
		});

		it('should return null for reference with only numbers', () => {
			expect(extractTermFromReference('12345')).toBeNull();
		});

		it('should return null for reference starting with non-ABC letter', () => {
			// Note: /[ABC](\d+)-/ ne matche pas D, E, etc.
			expect(extractTermFromReference('D10-0001/2025')).toBeNull();
		});
	});

	describe('edge cases', () => {
		it('should handle single-digit terms', () => {
			expect(extractTermFromReference('A8-0123/2019')).toBe(8);
		});

		it('should handle multi-digit terms', () => {
			expect(extractTermFromReference('A100-0001/2099')).toBe(100);
		});

		it('should match first occurrence in ambiguous references', () => {
			expect(extractTermFromReference('A9-B10-0001')).toBe(9);
		});
	});
});

describe('generateLawId', () => {
	describe('integration with extractTermFromReference', () => {
		it('should use extracted term when available', () => {
			expect(generateLawId('A9-0045/2024', 10)).toBe('LWPE9-A9-0045-2024');
		});

		it('should use fallback term when extraction fails', () => {
			expect(generateLawId('2024/1234', 10)).toBe('LWPE10-2024-1234');
		});
	});

	describe('slash replacement', () => {
		it('should replace all slashes with dashes', () => {
			expect(generateLawId('A10-0215/2025', 10)).toBe('LWPE10-A10-0215-2025');
		});

		it('should handle multiple slashes', () => {
			expect(generateLawId('A9-0048/2022/REV', 10)).toBe('LWPE9-A9-0048-2022-REV');
		});

		it('should handle references without slashes', () => {
			expect(generateLawId('A10-0001', 10)).toBe('LWPE10-A10-0001');
		});
	});

	describe('term extraction priority', () => {
		it('should prioritize extracted term over fallback', () => {
			// Even with fallback 10, should extract 9 from reference
			const result = generateLawId('A9-0045/2024', 10);
			expect(result).toContain('LWPE9');
			expect(result).not.toContain('LWPE10');
		});

		it('should use fallback only when extraction returns null', () => {
			const result = generateLawId('UNKNOWN-REF', 10);
			expect(result).toBe('LWPE10-UNKNOWN-REF');
		});
	});

	describe('ID format consistency', () => {
		it('should produce IDs matching LWPE{term}-{reference-with-dashes} format', () => {
			const result = generateLawId('A10-0084/2025', 10);
			expect(result).toMatch(/^LWPE\d+-[A-Z0-9-]+$/);
		});

		it('should produce IDs that fit in varchar(50)', () => {
			const longRef = 'RC-B10-0071/2026/REVISED/AMENDED';
			const result = generateLawId(longRef, 10);
			expect(result.length).toBeLessThanOrEqual(50);
		});
	});
});
