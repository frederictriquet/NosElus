import { describe, it, expect } from 'vitest';
import { calculateJaccardSimilarity } from '../matcher';

describe('ParlGov Matcher - Jaccard Similarity', () => {
	describe('calculateJaccardSimilarity', () => {
		it('should return 1.0 for identical strings', () => {
			const score = calculateJaccardSimilarity('test string', 'test string');

			expect(score).toBe(1.0);
		});

		it('should return 0.0 for completely different strings', () => {
			const score = calculateJaccardSimilarity('alpha beta gamma', 'delta epsilon zeta');

			expect(score).toBe(0.0);
		});

		it('should return 0.0 for empty strings', () => {
			const score1 = calculateJaccardSimilarity('', '');
			const score2 = calculateJaccardSimilarity('test', '');
			const score3 = calculateJaccardSimilarity('', 'test');

			expect(score1).toBe(0.0);
			expect(score2).toBe(0.0);
			expect(score3).toBe(0.0);
		});

		it('should calculate correct Jaccard score for partial overlap', () => {
			// "alpha beta" vs "beta gamma"
			// Normalized: "alpha beta" vs "beta gamma"
			// Intersection: {beta} = 1
			// Union: {alpha, beta, gamma} = 3
			// Jaccard = 1/3 ≈ 0.33
			const score = calculateJaccardSimilarity('alpha beta', 'beta gamma');

			expect(score).toBeCloseTo(0.33, 1);
		});

		it('should be case-insensitive', () => {
			const score = calculateJaccardSimilarity('Test String', 'test string');

			expect(score).toBe(1.0);
		});

		it('should ignore accents', () => {
			const score = calculateJaccardSimilarity('République', 'Republique');

			expect(score).toBe(1.0);
		});

		it('should ignore punctuation', () => {
			const score = calculateJaccardSimilarity("L'Europe", 'Europe');

			// Après normalisation : "europe" vs "europe"
			expect(score).toBe(1.0);
		});

		it('should ignore French stop words', () => {
			const score = calculateJaccardSimilarity('Le Parti Socialiste', 'Parti Socialiste');

			// "le" et "parti" sont des stop words, reste "socialiste"
			expect(score).toBe(1.0);
		});

		it('should apply bonus for long words (8+ chars)', () => {
			const score = calculateJaccardSimilarity('ecologique', 'ecologique');

			// Base Jaccard = 1.0
			// Bonus long word = +0.2
			// Max capped at 1.0
			expect(score).toBe(1.0);
		});

		it('should apply bonus for long words in partial match', () => {
			// "test republicains" vs "other republicains"
			// Intersection: {republicains} (11 chars)
			// Union: {test, republicains, other}
			// Base Jaccard = 1/3 ≈ 0.33
			// Bonus = +0.2 (long word present)
			// Total ≈ 0.53
			const score = calculateJaccardSimilarity('test republicains', 'other republicains');

			expect(score).toBeGreaterThan(0.33);
			expect(score).toBeCloseTo(0.53, 1);
		});

		it('should not apply bonus if no long words in intersection', () => {
			const score = calculateJaccardSimilarity('test abc', 'abc def');

			// Intersection: {abc} (3 chars, pas de bonus)
			// Union: {test, abc, def}
			// Jaccard = 1/3 ≈ 0.33
			expect(score).toBeCloseTo(0.33, 1);
		});

		it('should handle custom long word threshold', () => {
			const config = { longWordMinLength: 5 };
			const score = calculateJaccardSimilarity('test party', 'other party', config);

			// "party" = 5 chars, atteint le seuil custom
			// Bonus appliqué
			expect(score).toBeGreaterThan(0.33);
		});

		it('should handle custom long word bonus', () => {
			const config = { longWordBonus: 0.5 };
			const score = calculateJaccardSimilarity('test republican', 'other republican', config);

			// Base ≈ 0.33, bonus custom = 0.5
			// Total ≈ 0.83
			expect(score).toBeCloseTo(0.83, 1);
		});

		it('should cap score at 1.0 even with large bonus', () => {
			const config = { longWordBonus: 0.9 };
			const score = calculateJaccardSimilarity('test republican', 'other republican', config);

			expect(score).toBeLessThanOrEqual(1.0);
		});

		it('should handle real party names: LFI exact match', () => {
			const score = calculateJaccardSimilarity('La France Insoumise', 'La France Insoumise');

			expect(score).toBe(1.0);
		});

		it('should handle real party names: LFI vs LFI-NFP', () => {
			const score = calculateJaccardSimilarity(
				'La France Insoumise - Nouveau Front populaire',
				'La France Insoumise'
			);

			// Normalized: "france insoumise nouveau populaire" vs "france insoumise"
			// Intersection: {france, insoumise}
			// Union: {france, insoumise, nouveau, populaire}
			// Base Jaccard = 2/4 = 0.5
			// Bonus pour "insoumise" (9 chars) = +0.2
			// Total ≈ 0.7
			expect(score).toBeCloseTo(0.7, 1);
		});

		it('should handle real party names: RN variations', () => {
			const score = calculateJaccardSimilarity('Rassemblement National', 'National Rally');

			// Normalized: "national" vs "national rally" (rassemblement est stop word)
			// Intersection: {national}
			// Union: {national, rally}
			// Base Jaccard = 1/2 = 0.5
			// "national" = 8 chars → bonus +0.2
			// Total ≈ 0.7
			expect(score).toBeCloseTo(0.7, 1);
		});

		it('should handle abbreviations vs full names', () => {
			const score = calculateJaccardSimilarity('LR', 'Les Républicains');

			// Normalized: "lr" vs "republicains"
			// No intersection = 0.0
			expect(score).toBe(0.0);
		});

		it('should be commutative', () => {
			const score1 = calculateJaccardSimilarity('alpha beta', 'gamma delta');
			const score2 = calculateJaccardSimilarity('gamma delta', 'alpha beta');

			expect(score1).toBe(score2);
		});

		it('should handle duplicate words in input', () => {
			const score = calculateJaccardSimilarity('test test test', 'test other');

			// Sets remove duplicates: {test} vs {test, other}
			// Intersection: {test}
			// Union: {test, other}
			// Jaccard = 1/2 = 0.5
			expect(score).toBe(0.5);
		});

		it('should handle word order differences', () => {
			const score = calculateJaccardSimilarity('alpha beta gamma', 'gamma beta alpha');

			// Same sets, order doesn't matter
			expect(score).toBe(1.0);
		});
	});
});
