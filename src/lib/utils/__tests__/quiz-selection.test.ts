/**
 * Tests pour quiz-selection.ts
 * Utilitaires de sélection et filtrage des lois pour le quiz politique
 */

import { describe, it, expect } from 'vitest';
import { selectQuizLaws, getAvailableQuizSizes } from '../quiz-selection';
import type { QuizLaw } from '$lib/stores/quiz';

/**
 * Factory pour créer une loi de test
 */
function createTestLaw(overrides?: Partial<QuizLaw>): QuizLaw {
	return {
		id: `LAW-${Math.random().toString(36).slice(2, 9)}`,
		title: 'Test Law Title',
		shortTitle: null,
		type: 'PJL',
		status: 'adopted',
		description: null,
		sourceUrl: null,
		summary: 'Test summary',
		summaryModel: 'gpt-4',
		tags: [],
		...overrides
	};
}

/**
 * Factory pour créer une collection de lois avec tags
 */
function createTestLawsWithTags(configs: Array<{ tagSlugs: string[] }>): QuizLaw[] {
	return configs.map((config, i) =>
		createTestLaw({
			id: `LAW-${i}`,
			title: `Law ${i}`,
			tags: config.tagSlugs.map((slug) => ({
				slug,
				name: slug.toUpperCase(),
				color: '#000000'
			}))
		})
	);
}

describe('quiz-selection', () => {
	describe('selectQuizLaws', () => {
		describe('Filtrage par tags', () => {
			it('should filter laws by selected tags', () => {
				const laws = createTestLawsWithTags([
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['sante'] },
					{ tagSlugs: ['economie'] }
				]);

				const selectedTags = new Set(['economie']);
				const result = selectQuizLaws(laws, selectedTags, 10);

				expect(result.quizLaws).toHaveLength(2);
				expect(result.quizLaws.every((law) => law.tags.some((t) => t.slug === 'economie'))).toBe(
					true
				);
			});

			it('should return empty when no tags match', () => {
				const laws = createTestLawsWithTags([{ tagSlugs: ['economie'] }, { tagSlugs: ['sante'] }]);

				const selectedTags = new Set(['education']);
				const result = selectQuizLaws(laws, selectedTags, 10);

				expect(result.quizLaws).toHaveLength(0);
				expect(result.reserveLaws).toHaveLength(0);
			});

			it('should handle laws with multiple tags', () => {
				const laws = createTestLawsWithTags([
					{ tagSlugs: ['economie', 'emploi'] },
					{ tagSlugs: ['sante', 'social'] },
					{ tagSlugs: ['economie', 'fiscalite'] }
				]);

				const selectedTags = new Set(['economie', 'sante']);
				const result = selectQuizLaws(laws, selectedTags, 10);

				expect(result.quizLaws).toHaveLength(3);
			});

			it('should match if ANY tag is selected (OR logic)', () => {
				const laws = createTestLawsWithTags([
					{ tagSlugs: ['economie', 'emploi'] },
					{ tagSlugs: ['sante'] }
				]);

				const selectedTags = new Set(['emploi']); // Only 'emploi' selected
				const result = selectQuizLaws(laws, selectedTags, 10);

				expect(result.quizLaws).toHaveLength(1);
				expect(result.quizLaws[0].id).toBe('LAW-0');
			});
		});

		describe('Stratification par tag', () => {
			it('should stratify by primary tag', () => {
				const laws = createTestLawsWithTags([
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['sante'] },
					{ tagSlugs: ['sante'] },
					{ tagSlugs: ['sante'] }
				]);

				const selectedTags = new Set(['economie', 'sante']);
				const result = selectQuizLaws(laws, selectedTags, 4);

				// Should take ~2 from each tag for balanced representation
				expect(result.quizLaws).toHaveLength(4);

				const economieLaws = result.quizLaws.filter((l) => l.tags[0].slug === 'economie');
				const santeLaws = result.quizLaws.filter((l) => l.tags[0].slug === 'sante');

				// Both tags should be represented
				expect(economieLaws.length).toBeGreaterThan(0);
				expect(santeLaws.length).toBeGreaterThan(0);
			});

			it('should handle single tag', () => {
				const laws = createTestLawsWithTags([
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] }
				]);

				const selectedTags = new Set(['economie']);
				const result = selectQuizLaws(laws, selectedTags, 2);

				expect(result.quizLaws).toHaveLength(2);
				expect(result.reserveLaws).toHaveLength(1);
			});
		});

		describe('Split quiz/réserve', () => {
			it('should split laws into quiz and reserve', () => {
				const laws = createTestLawsWithTags([
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] }
				]);

				const selectedTags = new Set(['economie']);
				const result = selectQuizLaws(laws, selectedTags, 3);

				expect(result.quizLaws).toHaveLength(3);
				expect(result.reserveLaws).toHaveLength(2);
			});

			it('should put excess laws in reserve', () => {
				const laws = createTestLawsWithTags(
					Array.from({ length: 30 }, (_, i) => ({ tagSlugs: ['economie'] }))
				);

				const selectedTags = new Set(['economie']);
				const result = selectQuizLaws(laws, selectedTags, 15);

				expect(result.quizLaws).toHaveLength(15);
				expect(result.reserveLaws).toHaveLength(15);
			});

			it('should handle quizSize larger than available laws', () => {
				const laws = createTestLawsWithTags([
					{ tagSlugs: ['economie'] },
					{ tagSlugs: ['economie'] }
				]);

				const selectedTags = new Set(['economie']);
				const result = selectQuizLaws(laws, selectedTags, 10);

				expect(result.quizLaws).toHaveLength(2);
				expect(result.reserveLaws).toHaveLength(0);
			});
		});

		describe('Cas limites', () => {
			it('should handle empty law list', () => {
				const result = selectQuizLaws([], new Set(['economie']), 10);

				expect(result.quizLaws).toHaveLength(0);
				expect(result.reserveLaws).toHaveLength(0);
			});

			it('should handle empty tag selection', () => {
				const laws = createTestLawsWithTags([{ tagSlugs: ['economie'] }]);

				const result = selectQuizLaws(laws, new Set(), 10);

				expect(result.quizLaws).toHaveLength(0);
				expect(result.reserveLaws).toHaveLength(0);
			});

			it('should handle laws with no tags', () => {
				const laws = [createTestLaw({ tags: [] })];

				const result = selectQuizLaws(laws, new Set(['economie']), 10);

				expect(result.quizLaws).toHaveLength(0);
				expect(result.reserveLaws).toHaveLength(0);
			});

			it('should not duplicate laws between quiz and reserve', () => {
				const laws = createTestLawsWithTags(
					Array.from({ length: 10 }, () => ({ tagSlugs: ['economie'] }))
				);

				const selectedTags = new Set(['economie']);
				const result = selectQuizLaws(laws, selectedTags, 5);

				const quizIds = new Set(result.quizLaws.map((l) => l.id));
				const reserveIds = new Set(result.reserveLaws.map((l) => l.id));

				// No intersection
				const intersection = [...quizIds].filter((id) => reserveIds.has(id));
				expect(intersection).toHaveLength(0);
			});
		});

		describe('Randomization', () => {
			it('should shuffle laws (non-deterministic)', () => {
				const laws = createTestLawsWithTags(
					Array.from({ length: 20 }, (_, i) => ({ tagSlugs: ['economie'] }))
				);

				const selectedTags = new Set(['economie']);

				// Run multiple times and check for different orders
				const results = Array.from({ length: 5 }, () => selectQuizLaws(laws, selectedTags, 10));

				const orders = results.map((r) => r.quizLaws.map((l) => l.id).join(','));

				// At least 2 different orders should exist
				const uniqueOrders = new Set(orders);
				expect(uniqueOrders.size).toBeGreaterThan(1);
			});
		});
	});

	describe('getAvailableQuizSizes', () => {
		const SIZES = [5, 10, 15, 20];

		it('should return all sizes when enough laws', () => {
			const sizes = getAvailableQuizSizes(25);

			expect(sizes).toEqual(SIZES);
		});

		it('should filter out sizes larger than lawCount', () => {
			const sizes = getAvailableQuizSizes(12);

			expect(sizes).toEqual([5, 10]);
		});

		it('should return single size when lawCount between standard sizes', () => {
			const sizes = getAvailableQuizSizes(7);

			expect(sizes).toEqual([5]);
		});

		it('should return lawCount when less than 5', () => {
			const sizes = getAvailableQuizSizes(3);

			expect(sizes).toEqual([3]);
		});

		it('should handle exactly matching a standard size', () => {
			const sizes = getAvailableQuizSizes(15);

			expect(sizes).toEqual([5, 10, 15]);
		});

		it('should return empty array when 0 laws', () => {
			const sizes = getAvailableQuizSizes(0);

			expect(sizes).toEqual([]);
		});

		it('should handle single law', () => {
			const sizes = getAvailableQuizSizes(1);

			expect(sizes).toEqual([1]);
		});

		it('should handle exactly 20 laws', () => {
			const sizes = getAvailableQuizSizes(20);

			expect(sizes).toEqual(SIZES);
		});

		it('should handle more than 20 laws', () => {
			const sizes = getAvailableQuizSizes(100);

			expect(sizes).toEqual(SIZES);
		});
	});
});
