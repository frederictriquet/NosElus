import { describe, it, expect } from 'vitest';
import {
	sortByPoliticalPosition,
	isNonInscrit,
	getEffectivePosition,
	groupByPoliticalCategory,
	type OrganWithPosition
} from './political-spectrum';

describe('political-spectrum', () => {
	const createOrgan = (overrides: Partial<OrganWithPosition> = {}): OrganWithPosition => ({
		id: 'TEST_001',
		name: 'Test Group',
		shortName: 'TEST',
		politicalPosition: null,
		...overrides
	});

	describe('isNonInscrit', () => {
		it('should detect NI by shortName', () => {
			const organ = createOrgan({ shortName: 'NI' });
			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should detect NI by name', () => {
			const organ = createOrgan({ name: 'Non-inscrits', shortName: null });
			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should detect NA as NI', () => {
			const organ = createOrgan({ shortName: 'NA' });
			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should not detect regular groups as NI', () => {
			const organ = createOrgan({ name: 'La France Insoumise', shortName: 'LFI' });
			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should be case-insensitive', () => {
			const organ = createOrgan({ shortName: 'ni' });
			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should use custom identifiers', () => {
			const organ = createOrgan({ shortName: 'IND' });
			expect(isNonInscrit(organ)).toBe(false);
			expect(isNonInscrit(organ, ['IND'])).toBe(true);
		});
	});

	describe('getEffectivePosition', () => {
		it('should return DB position when available', () => {
			const organ = createOrgan({ politicalPosition: 3.5 });
			expect(getEffectivePosition(organ)).toBe(3.5);
		});

		it('should return 999 for NI groups', () => {
			const organ = createOrgan({ shortName: 'NI', politicalPosition: null });
			expect(getEffectivePosition(organ)).toBe(999);
		});

		it('should return default (5.0) for unknown groups', () => {
			const organ = createOrgan({ politicalPosition: null });
			expect(getEffectivePosition(organ)).toBe(5.0);
		});

		it('should use custom niPosition', () => {
			const organ = createOrgan({ shortName: 'NI', politicalPosition: null });
			expect(getEffectivePosition(organ, { niPosition: 100 })).toBe(100);
		});

		it('should use custom defaultPosition', () => {
			const organ = createOrgan({ politicalPosition: null });
			expect(getEffectivePosition(organ, { defaultPosition: 6.0 })).toBe(6.0);
		});

		it('should prioritize DB position over NI detection', () => {
			const organ = createOrgan({ shortName: 'NI', politicalPosition: 5.0 });
			expect(getEffectivePosition(organ)).toBe(5.0);
		});
	});

	describe('sortByPoliticalPosition', () => {
		it('should sort groups from left to right', () => {
			const groups = [
				createOrgan({ id: 'RN', name: 'RN', politicalPosition: 8.5 }),
				createOrgan({ id: 'LFI', name: 'LFI', politicalPosition: 1.5 }),
				createOrgan({ id: 'RE', name: 'RE', politicalPosition: 5.5 })
			];

			const sorted = sortByPoliticalPosition(groups);

			expect(sorted.map((g) => g.id)).toEqual(['LFI', 'RE', 'RN']);
		});

		it('should place NI at the end', () => {
			const groups = [
				createOrgan({ id: 'NI', name: 'Non-inscrits', shortName: 'NI', politicalPosition: null }),
				createOrgan({ id: 'LFI', name: 'LFI', politicalPosition: 1.5 }),
				createOrgan({ id: 'RN', name: 'RN', politicalPosition: 8.5 })
			];

			const sorted = sortByPoliticalPosition(groups);

			expect(sorted.map((g) => g.id)).toEqual(['LFI', 'RN', 'NI']);
		});

		it('should not modify original array', () => {
			const groups = [
				createOrgan({ id: 'B', name: 'B', politicalPosition: 5.0 }),
				createOrgan({ id: 'A', name: 'A', politicalPosition: 2.0 })
			];

			const sorted = sortByPoliticalPosition(groups);

			expect(groups[0].id).toBe('B');
			expect(sorted[0].id).toBe('A');
		});

		it('should sort alphabetically when positions are equal', () => {
			const groups = [
				createOrgan({ id: 'B', name: 'Zulu', politicalPosition: 5.0 }),
				createOrgan({ id: 'A', name: 'Alpha', politicalPosition: 5.0 })
			];

			const sorted = sortByPoliticalPosition(groups);

			expect(sorted.map((g) => g.id)).toEqual(['A', 'B']);
		});

		it('should handle empty array', () => {
			expect(sortByPoliticalPosition([])).toEqual([]);
		});

		it('should handle single element', () => {
			const groups = [createOrgan({ id: 'A', politicalPosition: 5.0 })];
			const sorted = sortByPoliticalPosition(groups);
			expect(sorted.length).toBe(1);
			expect(sorted[0].id).toBe('A');
		});

		it('should use default position (5.0) for null positions', () => {
			const groups = [
				createOrgan({ id: 'A', name: 'A', politicalPosition: 4.0 }),
				createOrgan({ id: 'B', name: 'B', politicalPosition: null }),
				createOrgan({ id: 'C', name: 'C', politicalPosition: 6.0 })
			];

			const sorted = sortByPoliticalPosition(groups);

			// B has default 5.0, so order is: A(4.0), B(5.0), C(6.0)
			expect(sorted.map((g) => g.id)).toEqual(['A', 'B', 'C']);
		});
	});

	describe('groupByPoliticalCategory', () => {
		it('should categorize groups correctly', () => {
			const groups = [
				createOrgan({ id: 'LFI', name: 'LFI', politicalPosition: 1.5 }),
				createOrgan({ id: 'SOC', name: 'SOC', politicalPosition: 3.0 }),
				createOrgan({ id: 'RE', name: 'RE', politicalPosition: 5.0 }),
				createOrgan({ id: 'LR', name: 'LR', politicalPosition: 7.0 }),
				createOrgan({ id: 'RN', name: 'RN', politicalPosition: 8.5 }),
				createOrgan({ id: 'NI', name: 'NI', shortName: 'NI', politicalPosition: null })
			];

			const categories = groupByPoliticalCategory(groups);

			expect(categories.left.map((g) => g.id)).toEqual(['LFI', 'SOC']);
			expect(categories.center.map((g) => g.id)).toEqual(['RE']);
			expect(categories.right.map((g) => g.id)).toEqual(['LR', 'RN']);
			expect(categories.ni.map((g) => g.id)).toEqual(['NI']);
		});

		it('should sort within each category', () => {
			const groups = [
				createOrgan({ id: 'B', name: 'B', politicalPosition: 2.0 }),
				createOrgan({ id: 'A', name: 'A', politicalPosition: 1.0 })
			];

			const categories = groupByPoliticalCategory(groups);

			expect(categories.left.map((g) => g.id)).toEqual(['A', 'B']);
		});

		it('should handle empty input', () => {
			const categories = groupByPoliticalCategory([]);

			expect(categories.left).toEqual([]);
			expect(categories.center).toEqual([]);
			expect(categories.right).toEqual([]);
			expect(categories.ni).toEqual([]);
		});
	});

	describe('real-world scenarios', () => {
		it('should correctly sort AN groups', () => {
			const groups = [
				createOrgan({ id: 'RN', name: 'Rassemblement National', shortName: 'RN', politicalPosition: 8.5 }),
				createOrgan({ id: 'LFI', name: 'La France Insoumise', shortName: 'LFI-NFP', politicalPosition: 1.5 }),
				createOrgan({ id: 'GDR', name: 'Gauche démocrate et républicaine', shortName: 'GDR', politicalPosition: 2.0 }),
				createOrgan({ id: 'SOC', name: 'Socialistes', shortName: 'SOC', politicalPosition: 3.0 }),
				createOrgan({ id: 'RE', name: 'Renaissance', shortName: 'RE', politicalPosition: 5.5 }),
				createOrgan({ id: 'LR', name: 'Les Républicains', shortName: 'LR', politicalPosition: 7.0 }),
				createOrgan({ id: 'NI', name: 'Non-inscrits', shortName: 'NI', politicalPosition: 999 })
			];

			const sorted = sortByPoliticalPosition(groups);

			expect(sorted.map((g) => g.id)).toEqual(['LFI', 'GDR', 'SOC', 'RE', 'LR', 'RN', 'NI']);
		});

		it('should handle PE groups with different naming', () => {
			const groups = [
				createOrgan({ id: 'PPE', name: 'Parti Populaire Européen', shortName: 'PPE', politicalPosition: 6.5 }),
				createOrgan({ id: 'SD', name: 'Socialistes & Démocrates', shortName: 'S&D', politicalPosition: 3.5 }),
				createOrgan({ id: 'GUE', name: 'Gauche Unitaire Européenne', shortName: 'GUE/NGL', politicalPosition: 1.5 }),
				createOrgan({ id: 'NA', name: 'Non-affiliés', shortName: 'NA', politicalPosition: null })
			];

			const sorted = sortByPoliticalPosition(groups);

			expect(sorted.map((g) => g.id)).toEqual(['GUE', 'SD', 'PPE', 'NA']);
		});
	});
});
