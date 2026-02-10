import { describe, it, expect } from 'vitest';
import { generateLawId } from '../shared';

/**
 * Tests de non-régression pour les corrections du pipeline ETL PE votes.
 *
 * Bug corrigé : generateLawId() utilisait le terme courant (fallback) pour toutes
 * les références, au lieu d'extraire le terme depuis le pattern de référence
 * (A9-* → terme 9, A10-* → terme 10, RC-B10-* → terme 10).
 * Résultat : les lawId générés ne correspondaient pas à ceux de la table laws,
 * cassant le lien scrutin ↔ loi.
 */
describe('generateLawId', () => {
	describe('term extraction from reference', () => {
		it('should extract term 9 from A9-* reference', () => {
			expect(generateLawId('A9-0045/2024', 10)).toBe('LWPE9-A9-0045-2024');
		});

		it('should extract term 10 from A10-* reference', () => {
			expect(generateLawId('A10-0084/2025', 10)).toBe('LWPE10-A10-0084-2025');
		});

		it('should extract term 10 from RC-B10-* reference', () => {
			expect(generateLawId('RC-B10-0071/2026', 10)).toBe('LWPE10-RC-B10-0071-2026');
		});

		it('should extract term 9 from C9-* reference', () => {
			expect(generateLawId('C9-0211/2020', 10)).toBe('LWPE9-C9-0211-2020');
		});

		it('should extract term 9 from B9-* reference', () => {
			expect(generateLawId('B9-0123/2021', 10)).toBe('LWPE9-B9-0123-2021');
		});
	});

	describe('fallback term', () => {
		it('should use fallback term when no term pattern found', () => {
			expect(generateLawId('2024/1234', 10)).toBe('LWPE10-2024-1234');
		});
	});

	describe('slash replacement', () => {
		it('should replace slashes with dashes in reference', () => {
			expect(generateLawId('A10-0215/2025', 10)).toBe('LWPE10-A10-0215-2025');
		});

		it('should handle references with multiple slashes', () => {
			expect(generateLawId('A9-0048/2022/REV', 10)).toBe('LWPE9-A9-0048-2022-REV');
		});
	});

	describe('regression: term mismatch between votes and laws', () => {
		it('should NOT use fallback term 10 for term-9 references', () => {
			// Before fix: generateLawId('A9-0045/2024', 10) → 'LWPE10-A9-0045-2024' (WRONG)
			// After fix:  generateLawId('A9-0045/2024', 10) → 'LWPE9-A9-0045-2024'  (CORRECT)
			const result = generateLawId('A9-0045/2024', 10);
			expect(result).not.toContain('LWPE10');
			expect(result).toContain('LWPE9');
		});

		it('should produce IDs that fit in varchar(50)', () => {
			// Bug 3: lawId like 'LWPE10-RC-B10-0071-2026' (23 chars) exceeded varchar(20)
			const longRef = 'RC-B10-0071/2026';
			const result = generateLawId(longRef, 10);
			expect(result.length).toBeLessThanOrEqual(50);
		});
	});
});
