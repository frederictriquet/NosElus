import { describe, it, expect } from 'vitest';
import { detectDirection, computeVerdict } from './verdict';
import type { GroupVoteResult } from '$lib/server/api/helpers';

// ============================================================
// Helpers
// ============================================================

function makeGroupVote(pour: number, contre: number, abstention: number): GroupVoteResult {
	const total = pour + contre + abstention;
	return {
		groupId: 'test-group',
		pour,
		contre,
		abstention,
		total,
		pctPour: total > 0 ? Math.round((pour / total) * 100) : 0,
		pctContre: total > 0 ? Math.round((contre / total) * 100) : 0,
		pctAbstention: total > 0 ? Math.round((abstention / total) * 100) : 0
	};
}

function makeScrutin(gv: GroupVoteResult | null) {
	return { groupVote: gv };
}

const GV_CONTRE_FORT = makeGroupVote(5, 90, 5); // 90% contre
const GV_POUR_FORT = makeGroupVote(90, 5, 5); // 90% pour
const GV_ABSTENTION_FORT = makeGroupVote(5, 5, 90); // 90% abstention
const GV_NUANCE = makeGroupVote(50, 40, 10); // 50% pour — pas de majorité

// ============================================================
// detectDirection
// ============================================================

describe('detectDirection', () => {
	describe('direction "contre"', () => {
		it('should detect "contre" from standard phrasing', () => {
			expect(detectDirection("Le RN a voté contre l'augmentation du SMIC")).toBe('contre');
		});

		it('should detect "contre" in lowercase', () => {
			expect(detectDirection('le groupe est contre cette mesure')).toBe('contre');
		});

		it('should detect "s\'oppose"', () => {
			expect(detectDirection("le parti s'oppose à cette réforme")).toBe('contre');
		});

		it('should detect "rejette"', () => {
			expect(detectDirection('le groupe rejette la proposition')).toBe('contre');
		});

		it('should detect "défavorable"', () => {
			expect(detectDirection('la majorité est défavorable au texte')).toBe('contre');
		});
	});

	describe('direction "pour"', () => {
		it('should detect "défend" from standard phrasing', () => {
			expect(detectDirection('le RN défend les travailleurs')).toBe('pour');
		});

		it('should detect "soutient"', () => {
			expect(detectDirection('le groupe soutient cette mesure')).toBe('pour');
		});

		it('should detect "en faveur"', () => {
			expect(detectDirection('ils ont voté en faveur de la loi')).toBe('pour');
		});

		it('should detect "favorable"', () => {
			expect(detectDirection('le groupe est favorable à cette proposition')).toBe('pour');
		});

		it('should detect "approuve"', () => {
			expect(detectDirection('la droite approuve ce texte')).toBe('pour');
		});
	});

	describe('direction "abstention"', () => {
		it('should detect "abstention"', () => {
			expect(detectDirection('le groupe est resté en abstention')).toBe('abstention');
		});

		it('should detect "s\'abstient"', () => {
			expect(detectDirection("le parti s'abstient sur ce vote")).toBe('abstention');
		});

		it('should detect "abstiennent"', () => {
			expect(detectDirection('les membres abstiennent lors du vote')).toBe('abstention');
		});
	});

	describe('cas null', () => {
		it('should return null when no direction marker found', () => {
			expect(detectDirection('SMIC RN 2022')).toBeNull();
		});

		it('should return null for empty string', () => {
			expect(detectDirection('')).toBeNull();
		});

		it('should return null when both pour and contre are present (ambiguity)', () => {
			// "défend" (pour) + "s'oppose" (contre) → ambiguïté réelle
			expect(
				detectDirection("le parti défend certaines mesures mais s'oppose à d'autres")
			).toBeNull();
		});

		it('should return null for query with only group name', () => {
			expect(detectDirection('RN retraites 2023')).toBeNull();
		});
	});
});

// ============================================================
// computeVerdict
// ============================================================

describe('computeVerdict', () => {
	describe('cas de base — verdict confirmé', () => {
		it('should return confirmé when all scrutins confirm direction "contre"', () => {
			const scrutins = [
				makeScrutin(GV_CONTRE_FORT),
				makeScrutin(GV_CONTRE_FORT),
				makeScrutin(GV_CONTRE_FORT)
			];
			const result = computeVerdict(scrutins, 'contre');
			expect(result).not.toBeNull();
			expect(result!.verdict).toBe('confirmé');
			expect(result!.confirmPct).toBe(100);
			expect(result!.scrutinCount).toBe(3);
		});

		it('should return confirmé when all scrutins confirm direction "pour"', () => {
			const scrutins = [makeScrutin(GV_POUR_FORT), makeScrutin(GV_POUR_FORT)];
			const result = computeVerdict(scrutins, 'pour');
			expect(result!.verdict).toBe('confirmé');
			expect(result!.confirmPct).toBe(100);
		});

		it('should return confirmé when ≥ 60% confirm', () => {
			// 3 confirment sur 5 = 60%
			const scrutins = [
				makeScrutin(GV_CONTRE_FORT),
				makeScrutin(GV_CONTRE_FORT),
				makeScrutin(GV_CONTRE_FORT),
				makeScrutin(GV_NUANCE),
				makeScrutin(GV_NUANCE)
			];
			const result = computeVerdict(scrutins, 'contre');
			expect(result!.verdict).toBe('confirmé');
			expect(result!.confirmPct).toBe(60);
		});
	});

	describe('cas de base — verdict infirmé', () => {
		it('should return infirmé when all scrutins infirm direction "contre"', () => {
			const scrutins = [makeScrutin(GV_POUR_FORT), makeScrutin(GV_POUR_FORT)];
			const result = computeVerdict(scrutins, 'contre');
			expect(result!.verdict).toBe('infirmé');
		});

		it('should return infirmé when all scrutins infirm direction "pour"', () => {
			const scrutins = [makeScrutin(GV_CONTRE_FORT), makeScrutin(GV_CONTRE_FORT)];
			const result = computeVerdict(scrutins, 'pour');
			expect(result!.verdict).toBe('infirmé');
		});
	});

	describe('verdict nuancé', () => {
		it('should return nuancé when votes are mixed (below 60% threshold)', () => {
			// 1 confirme, 1 infirme, 1 nuancé → < 60% partout
			const scrutins = [
				makeScrutin(GV_CONTRE_FORT), // confirme direction=contre
				makeScrutin(GV_POUR_FORT), // infirme direction=contre
				makeScrutin(GV_NUANCE) // ni l'un ni l'autre
			];
			const result = computeVerdict(scrutins, 'contre');
			expect(result!.verdict).toBe('nuancé');
		});

		it('should return nuancé when group votes are mixed without clear majority', () => {
			const scrutins = [makeScrutin(GV_NUANCE), makeScrutin(GV_NUANCE)];
			const result = computeVerdict(scrutins, 'contre');
			expect(result!.verdict).toBe('nuancé');
		});
	});

	describe('abstention', () => {
		it('should return confirmé when group mostly abstained for direction "abstention"', () => {
			const scrutins = [makeScrutin(GV_ABSTENTION_FORT)];
			const result = computeVerdict(scrutins, 'abstention');
			expect(result!.verdict).toBe('confirmé');
		});

		it('should return infirmé when group voted clearly for direction "abstention"', () => {
			const scrutins = [makeScrutin(GV_POUR_FORT)];
			const result = computeVerdict(scrutins, 'abstention');
			expect(result!.verdict).toBe('infirmé');
		});
	});

	describe('données manquantes', () => {
		it('should return null when no scrutins have groupVote', () => {
			const scrutins = [makeScrutin(null), makeScrutin(null)];
			const result = computeVerdict(scrutins, 'contre');
			expect(result).toBeNull();
		});

		it('should return null when scrutins array is empty', () => {
			const result = computeVerdict([], 'contre');
			expect(result).toBeNull();
		});

		it('should ignore scrutins with null groupVote in count', () => {
			const scrutins = [
				makeScrutin(GV_CONTRE_FORT),
				makeScrutin(null), // ignoré
				makeScrutin(GV_CONTRE_FORT)
			];
			const result = computeVerdict(scrutins, 'contre');
			expect(result!.scrutinCount).toBe(2); // seulement les 2 avec groupVote
			expect(result!.confirmPct).toBe(100);
		});
	});

	describe('scrutinCount', () => {
		it('should report scrutinCount equal to number of scrutins with groupVote', () => {
			const scrutins = [
				makeScrutin(GV_CONTRE_FORT),
				makeScrutin(null),
				makeScrutin(GV_CONTRE_FORT),
				makeScrutin(GV_NUANCE),
				makeScrutin(null)
			];
			const result = computeVerdict(scrutins, 'contre');
			expect(result!.scrutinCount).toBe(3);
		});
	});
});
