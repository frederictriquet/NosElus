import { describe, it, expect } from 'vitest';
import {
	type GroupData,
	sortAndLimitGroups,
	prepareByGroupData,
	prepareByPositionData
} from './GroupVotesStackedBar.utils';

describe('GroupVotesStackedBar', () => {
	const createMockGroup = (overrides: Partial<GroupData> = {}): GroupData => ({
		id: 'PO_TEST',
		name: 'Test Group',
		shortName: 'TEST',
		color: '#FF0000',
		pour: 10,
		contre: 5,
		abstention: 3,
		nonVotant: 2,
		total: 20,
		...overrides
	});

	describe('sortAndLimitGroups', () => {
		it('should sort groups by total votes descending', () => {
			const groups = [
				createMockGroup({ id: 'A', total: 10 }),
				createMockGroup({ id: 'B', total: 30 }),
				createMockGroup({ id: 'C', total: 20 })
			];

			const result = sortAndLimitGroups(groups, 10);

			expect(result.map((g) => g.id)).toEqual(['B', 'C', 'A']);
		});

		it('should limit to maxGroups', () => {
			const groups = [
				createMockGroup({ id: 'A', total: 100 }),
				createMockGroup({ id: 'B', total: 80 }),
				createMockGroup({ id: 'C', total: 60 }),
				createMockGroup({ id: 'D', total: 40 }),
				createMockGroup({ id: 'E', total: 20 })
			];

			const result = sortAndLimitGroups(groups, 3);

			expect(result.length).toBe(3);
			expect(result.map((g) => g.id)).toEqual(['A', 'B', 'C']);
		});

		it('should handle empty array', () => {
			const result = sortAndLimitGroups([], 10);
			expect(result).toEqual([]);
		});
	});

	describe('prepareByGroupData (mode: by-group)', () => {
		it('should prepare data with all vote positions', () => {
			const groups = [
				createMockGroup({
					id: 'LFI',
					shortName: 'LFI',
					pour: 50,
					contre: 10,
					abstention: 5,
					nonVotant: 2,
					total: 67
				})
			];

			const result = prepareByGroupData(groups, 10);

			expect(result).not.toBeNull();
			expect(result!.seriesNames).toEqual(['pour', 'contre', 'abstention', 'nonVotant']);
			expect(result!.dataForStack[0]).toMatchObject({
				label: 'LFI',
				pour: 50,
				contre: 10,
				abstention: 5,
				nonVotant: 2,
				total: 67
			});
		});

		it('should use shortName as label when available', () => {
			const groups = [
				createMockGroup({ shortName: 'RN' }),
				createMockGroup({ shortName: null, name: 'Long Group Name' })
			];

			const result = prepareByGroupData(groups, 10);

			expect(result!.dataForStack[0].label).toBe('RN');
			expect(result!.dataForStack[1].label).toBe('Long Group');
		});

		it('should return null for empty groups', () => {
			const result = prepareByGroupData([], 10);
			expect(result).toBeNull();
		});

		it('should preserve vote counts across transformation', () => {
			const groups = [
				createMockGroup({
					pour: 30,
					contre: 20,
					abstention: 10,
					nonVotant: 5,
					total: 65
				}),
				createMockGroup({
					pour: 15,
					contre: 25,
					abstention: 8,
					nonVotant: 2,
					total: 50
				})
			];

			const result = prepareByGroupData(groups, 10);

			const totalPour = result!.dataForStack.reduce((sum, d) => sum + d.pour, 0);
			const totalContre = result!.dataForStack.reduce((sum, d) => sum + d.contre, 0);
			const totalAbstention = result!.dataForStack.reduce((sum, d) => sum + d.abstention, 0);
			const totalNonVotant = result!.dataForStack.reduce((sum, d) => sum + d.nonVotant, 0);

			expect(totalPour).toBe(45);
			expect(totalContre).toBe(45);
			expect(totalAbstention).toBe(18);
			expect(totalNonVotant).toBe(7);
		});
	});

	describe('prepareByPositionData (mode: by-position)', () => {
		it('should create bars for each position', () => {
			const groups = [
				createMockGroup({
					id: 'LFI',
					shortName: 'LFI',
					pour: 50,
					contre: 10,
					abstention: 5,
					nonVotant: 2
				})
			];

			const result = prepareByPositionData(groups, 10);

			expect(result).not.toBeNull();
			expect(result!.dataForStack.length).toBe(4);
			expect(result!.dataForStack.map((d) => d.label)).toEqual([
				'Pour',
				'Contre',
				'Abstention',
				'Non-votant'
			]);
		});

		it('should stack groups within each position', () => {
			const groups = [
				createMockGroup({
					id: 'LFI',
					shortName: 'LFI',
					pour: 50,
					contre: 10,
					abstention: 5,
					nonVotant: 2
				}),
				createMockGroup({
					id: 'RN',
					shortName: 'RN',
					pour: 30,
					contre: 40,
					abstention: 8,
					nonVotant: 1
				})
			];

			const result = prepareByPositionData(groups, 10);

			const pourBar = result!.dataForStack.find((d) => d.label === 'Pour');
			expect(pourBar!['LFI']).toBe(50);
			expect(pourBar!['RN']).toBe(30);
			expect(pourBar!['total']).toBe(80);

			const contreBar = result!.dataForStack.find((d) => d.label === 'Contre');
			expect(contreBar!['LFI']).toBe(10);
			expect(contreBar!['RN']).toBe(40);
			expect(contreBar!['total']).toBe(50);
		});

		it('should use shortName for group names, fallback to id', () => {
			const groups = [
				createMockGroup({ id: 'ID1', shortName: 'ABC' }),
				createMockGroup({ id: 'ID2', shortName: null })
			];

			const result = prepareByPositionData(groups, 10);

			expect(result!.groupNames).toEqual(['ABC', 'ID2']);
		});

		it('should return null for empty groups', () => {
			const result = prepareByPositionData([], 10);
			expect(result).toBeNull();
		});

		it('should preserve total votes across all positions', () => {
			const groups = [
				createMockGroup({
					pour: 30,
					contre: 20,
					abstention: 10,
					nonVotant: 5,
					total: 65
				}),
				createMockGroup({
					pour: 15,
					contre: 25,
					abstention: 8,
					nonVotant: 2,
					total: 50
				})
			];

			const result = prepareByPositionData(groups, 10);

			const grandTotal = result!.dataForStack.reduce((sum, d) => sum + (d.total as number), 0);
			const expectedTotal = groups.reduce((sum, g) => sum + g.total, 0);

			expect(grandTotal).toBe(expectedTotal);
		});

		it('should respect maxGroups limit', () => {
			const groups = Array.from({ length: 15 }, (_, i) =>
				createMockGroup({
					id: `GROUP_${i}`,
					shortName: `G${i}`,
					total: 100 - i // Descending totals
				})
			);

			const result = prepareByPositionData(groups, 10);

			expect(result!.groupNames.length).toBe(10);
			expect(result!.sortedGroups.length).toBe(10);
			// Should include top 10 groups
			expect(result!.groupNames).toEqual([
				'G0',
				'G1',
				'G2',
				'G3',
				'G4',
				'G5',
				'G6',
				'G7',
				'G8',
				'G9'
			]);
		});
	});

	describe('Edge cases', () => {
		it('should handle groups with zero votes', () => {
			const groups = [
				createMockGroup({
					pour: 0,
					contre: 0,
					abstention: 0,
					nonVotant: 0,
					total: 0
				})
			];

			const byGroupResult = prepareByGroupData(groups, 10);
			const byPositionResult = prepareByPositionData(groups, 10);

			expect(byGroupResult).not.toBeNull();
			expect(byPositionResult).not.toBeNull();
		});

		it('should handle very long group names', () => {
			const groups = [
				createMockGroup({
					shortName: null,
					name: 'This is a very long political group name that exceeds 10 characters'
				})
			];

			const result = prepareByGroupData(groups, 10);

			expect(result!.dataForStack[0].label).toBe('This is a ');
			expect(result!.dataForStack[0].label.length).toBe(10);
		});

		it('should handle single vote type dominance', () => {
			const groups = [
				createMockGroup({
					pour: 100,
					contre: 0,
					abstention: 0,
					nonVotant: 0,
					total: 100
				})
			];

			const result = prepareByPositionData(groups, 10);

			const pourBar = result!.dataForStack.find((d) => d.label === 'Pour');
			const contreBar = result!.dataForStack.find((d) => d.label === 'Contre');

			expect(pourBar!['total']).toBe(100);
			expect(contreBar!['total']).toBe(0);
		});
	});
});
