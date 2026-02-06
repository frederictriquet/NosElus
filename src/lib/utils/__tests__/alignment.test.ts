import { describe, it, expect } from 'vitest';
import {
	calculateAlignmentScore,
	calculateDetailedAlignment,
	sortAlignmentResults,
	getPodium,
	type UserVote,
	type GroupVote,
	type AlignmentResult
} from '../alignment';

describe('alignment', () => {
	// Factories pour les données de test
	const createUserVote = (lawId: string, position: 'pour' | 'contre'): UserVote => ({
		lawId,
		position
	});

	const createGroupVote = (lawId: string, majorityPosition: 'pour' | 'contre'): GroupVote => ({
		lawId,
		majorityPosition
	});

	const createAlignmentResult = (
		overrides: Partial<AlignmentResult> = {}
	): AlignmentResult => ({
		groupId: 'PO123456',
		groupName: 'Test Group',
		groupShortName: 'TEST',
		score: 50,
		agreements: 5,
		disagreements: 5,
		details: [],
		...overrides
	});

	describe('calculateAlignmentScore', () => {
		it('should return 100 for complete alignment', () => {
			const userVotes = [
				createUserVote('LAW1', 'pour'),
				createUserVote('LAW2', 'contre')
			];
			const groupVotes = [
				createGroupVote('LAW1', 'pour'),
				createGroupVote('LAW2', 'contre')
			];

			expect(calculateAlignmentScore(userVotes, groupVotes)).toBe(100);
		});

		it('should return 0 for complete disagreement', () => {
			const userVotes = [
				createUserVote('LAW1', 'pour'),
				createUserVote('LAW2', 'pour')
			];
			const groupVotes = [
				createGroupVote('LAW1', 'contre'),
				createGroupVote('LAW2', 'contre')
			];

			expect(calculateAlignmentScore(userVotes, groupVotes)).toBe(0);
		});

		it('should return 50 for half alignment', () => {
			const userVotes = [
				createUserVote('LAW1', 'pour'),
				createUserVote('LAW2', 'contre')
			];
			const groupVotes = [
				createGroupVote('LAW1', 'pour'),
				createGroupVote('LAW2', 'pour')
			];

			expect(calculateAlignmentScore(userVotes, groupVotes)).toBe(50);
		});

		it('should return 0 when no user votes', () => {
			const userVotes: UserVote[] = [];
			const groupVotes = [createGroupVote('LAW1', 'pour')];

			expect(calculateAlignmentScore(userVotes, groupVotes)).toBe(0);
		});

		it('should round to nearest integer', () => {
			const userVotes = [
				createUserVote('LAW1', 'pour'),
				createUserVote('LAW2', 'pour'),
				createUserVote('LAW3', 'pour')
			];
			const groupVotes = [
				createGroupVote('LAW1', 'pour'),
				createGroupVote('LAW2', 'contre'),
				createGroupVote('LAW3', 'contre')
			];

			// 1/3 = 0.333... → rounds to 33
			expect(calculateAlignmentScore(userVotes, groupVotes)).toBe(33);
		});

		it('should ignore group votes not in user votes', () => {
			const userVotes = [createUserVote('LAW1', 'pour')];
			const groupVotes = [
				createGroupVote('LAW1', 'pour'),
				createGroupVote('LAW2', 'contre'),
				createGroupVote('LAW3', 'pour')
			];

			expect(calculateAlignmentScore(userVotes, groupVotes)).toBe(100);
		});
	});

	describe('calculateDetailedAlignment', () => {
		const groupInfo = {
			id: 'PO123456',
			name: 'La France Insoumise - Nouveau Front populaire',
			shortName: 'LFI-NFP'
		};

		const lawTitles = new Map([
			['LAW1', 'Loi sur le climat'],
			['LAW2', 'Loi sur la sécurité'],
			['LAW3', 'Loi sur la santé']
		]);

		it('should calculate detailed alignment with all fields', () => {
			const userVotes = [
				createUserVote('LAW1', 'pour'),
				createUserVote('LAW2', 'contre')
			];
			const groupVotes = [
				createGroupVote('LAW1', 'pour'),
				createGroupVote('LAW2', 'contre')
			];

			const result = calculateDetailedAlignment(userVotes, groupVotes, groupInfo, lawTitles);

			expect(result.groupId).toBe('PO123456');
			expect(result.groupName).toBe('La France Insoumise - Nouveau Front populaire');
			expect(result.groupShortName).toBe('LFI-NFP');
			expect(result.score).toBe(100);
			expect(result.agreements).toBe(2);
			expect(result.disagreements).toBe(0);
			expect(result.details).toHaveLength(2);
		});

		it('should include vote details with law titles', () => {
			const userVotes = [createUserVote('LAW1', 'pour')];
			const groupVotes = [createGroupVote('LAW1', 'pour')];

			const result = calculateDetailedAlignment(userVotes, groupVotes, groupInfo, lawTitles);

			expect(result.details[0]).toEqual({
				lawId: 'LAW1',
				lawTitle: 'Loi sur le climat',
				userPosition: 'pour',
				groupPosition: 'pour',
				agreement: true
			});
		});

		it('should mark disagreements correctly', () => {
			const userVotes = [createUserVote('LAW1', 'pour')];
			const groupVotes = [createGroupVote('LAW1', 'contre')];

			const result = calculateDetailedAlignment(userVotes, groupVotes, groupInfo, lawTitles);

			expect(result.details[0].agreement).toBe(false);
			expect(result.agreements).toBe(0);
			expect(result.disagreements).toBe(1);
		});

		it('should use "Loi inconnue" when title not found', () => {
			const userVotes = [createUserVote('UNKNOWN', 'pour')];
			const groupVotes = [createGroupVote('UNKNOWN', 'pour')];

			const result = calculateDetailedAlignment(userVotes, groupVotes, groupInfo, lawTitles);

			expect(result.details[0].lawTitle).toBe('Loi inconnue');
		});

		it('should filter out laws where group did not vote', () => {
			const userVotes = [
				createUserVote('LAW1', 'pour'),
				createUserVote('LAW2', 'contre'),
				createUserVote('LAW3', 'pour')
			];
			const groupVotes = [
				createGroupVote('LAW1', 'pour'),
				// LAW2 : groupe n'a pas voté
				createGroupVote('LAW3', 'contre')
			];

			const result = calculateDetailedAlignment(userVotes, groupVotes, groupInfo, lawTitles);

			// LAW2 ne devrait pas être dans les détails
			expect(result.details).toHaveLength(2);
			expect(result.details.map((d) => d.lawId)).toEqual(['LAW1', 'LAW3']);
			expect(result.agreements).toBe(1); // LAW1
			expect(result.disagreements).toBe(1); // LAW3
			expect(result.score).toBe(50); // 1 accord sur 2 lois où le groupe a voté
		});

		it('should return score 0 when group voted on no laws', () => {
			const userVotes = [
				createUserVote('LAW1', 'pour'),
				createUserVote('LAW2', 'contre')
			];
			const groupVotes: GroupVote[] = [];

			const result = calculateDetailedAlignment(userVotes, groupVotes, groupInfo, lawTitles);

			expect(result.score).toBe(0);
			expect(result.agreements).toBe(0);
			expect(result.disagreements).toBe(0);
			expect(result.details).toHaveLength(0);
		});

		it('should calculate score based only on laws where group voted', () => {
			const userVotes = [
				createUserVote('LAW1', 'pour'),
				createUserVote('LAW2', 'pour'),
				createUserVote('LAW3', 'pour'),
				createUserVote('LAW4', 'pour')
			];
			const groupVotes = [
				createGroupVote('LAW1', 'pour'), // accord
				createGroupVote('LAW2', 'contre') // désaccord
				// LAW3, LAW4 : groupe n'a pas voté
			];

			const result = calculateDetailedAlignment(userVotes, groupVotes, groupInfo, lawTitles);

			// Score = 1 accord / 2 lois où le groupe a voté = 50%
			expect(result.score).toBe(50);
			expect(result.agreements).toBe(1);
			expect(result.disagreements).toBe(1);
			expect(result.details).toHaveLength(2);
		});
	});

	describe('sortAlignmentResults', () => {
		it('should sort by score descending', () => {
			const results = [
				createAlignmentResult({ groupId: 'A', score: 50 }),
				createAlignmentResult({ groupId: 'B', score: 80 }),
				createAlignmentResult({ groupId: 'C', score: 30 })
			];

			const sorted = sortAlignmentResults(results);

			expect(sorted.map((r) => r.groupId)).toEqual(['B', 'A', 'C']);
		});

		it('should not mutate original array', () => {
			const results = [
				createAlignmentResult({ score: 50 }),
				createAlignmentResult({ score: 80 })
			];

			sortAlignmentResults(results);

			expect(results[0].score).toBe(50); // Original unchanged
		});

		it('should handle empty array', () => {
			const sorted = sortAlignmentResults([]);
			expect(sorted).toEqual([]);
		});

		it('should handle single result', () => {
			const result = createAlignmentResult({ score: 75 });
			const sorted = sortAlignmentResults([result]);
			expect(sorted).toHaveLength(1);
			expect(sorted[0].score).toBe(75);
		});

		it('should maintain stable sort for equal scores', () => {
			const results = [
				createAlignmentResult({ groupId: 'A', score: 50 }),
				createAlignmentResult({ groupId: 'B', score: 50 }),
				createAlignmentResult({ groupId: 'C', score: 50 })
			];

			const sorted = sortAlignmentResults(results);

			// Order preserved for equal scores
			expect(sorted.map((r) => r.groupId)).toEqual(['A', 'B', 'C']);
		});
	});

	describe('getPodium', () => {
		it('should return top 3 results', () => {
			const results = [
				createAlignmentResult({ groupId: '1st', score: 90 }),
				createAlignmentResult({ groupId: '2nd', score: 80 }),
				createAlignmentResult({ groupId: '3rd', score: 70 }),
				createAlignmentResult({ groupId: '4th', score: 60 })
			];

			const podium = getPodium(results);

			expect(podium).toHaveLength(3);
			expect(podium.map((r) => r.groupId)).toEqual(['1st', '2nd', '3rd']);
		});

		it('should return all results when less than 3', () => {
			const results = [
				createAlignmentResult({ groupId: '1st' }),
				createAlignmentResult({ groupId: '2nd' })
			];

			const podium = getPodium(results);

			expect(podium).toHaveLength(2);
		});

		it('should return empty array for empty input', () => {
			const podium = getPodium([]);
			expect(podium).toEqual([]);
		});

		it('should not mutate original array', () => {
			const results = [
				createAlignmentResult({ groupId: 'A' }),
				createAlignmentResult({ groupId: 'B' })
			];

			getPodium(results);

			expect(results).toHaveLength(2); // Original unchanged
		});
	});
});
