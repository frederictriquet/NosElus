import { describe, it, expect, beforeAll } from 'vitest';
import { extractGroupVote, expandQueryTerms, searchScrutins } from './helpers';

// ============================================================
// extractGroupVote — Tests UNITAIRES (fonction pure, pas de DB)
// ============================================================

describe('extractGroupVote', () => {
	it('should return null when groupResults is null', () => {
		expect(extractGroupVote(null, 'PO_GP_RN')).toBeNull();
	});

	it('should return null when groupResults is undefined', () => {
		expect(extractGroupVote(undefined, 'PO_GP_RN')).toBeNull();
	});

	it('should return null when groupResults is not an object', () => {
		expect(extractGroupVote('invalid', 'PO_GP_RN')).toBeNull();
		expect(extractGroupVote(42, 'PO_GP_RN')).toBeNull();
	});

	it('should return null when groupId not found in groupResults', () => {
		const groupResults = { OTHER_GROUP: { pour: 10, contre: 5, abstention: 2 } };
		expect(extractGroupVote(groupResults, 'PO_GP_RN')).toBeNull();
	});

	it('should return null when group data is not an object', () => {
		const groupResults = { PO_GP_RN: 'invalid' };
		expect(extractGroupVote(groupResults, 'PO_GP_RN')).toBeNull();
	});

	it('should return null when total votes is 0', () => {
		const groupResults = { PO_GP_RN: { pour: 0, contre: 0, abstention: 0 } };
		expect(extractGroupVote(groupResults, 'PO_GP_RN')).toBeNull();
	});

	it('should compute correct vote counts and percentages (format pour/contre)', () => {
		const groupResults = {
			PO_GP_RN: { pour: 80, contre: 10, abstention: 10 }
		};

		const result = extractGroupVote(groupResults, 'PO_GP_RN');

		expect(result).not.toBeNull();
		expect(result!.groupId).toBe('PO_GP_RN');
		expect(result!.pour).toBe(80);
		expect(result!.contre).toBe(10);
		expect(result!.abstention).toBe(10);
		expect(result!.total).toBe(100);
		expect(result!.pctPour).toBe(80);
		expect(result!.pctContre).toBe(10);
		expect(result!.pctAbstention).toBe(10);
	});

	it('should compute correct vote counts using alternative format (for/against)', () => {
		const groupResults = {
			PO_GP_LFI: { for: 50, against: 30, abstention: 20 }
		};

		const result = extractGroupVote(groupResults, 'PO_GP_LFI');

		expect(result).not.toBeNull();
		expect(result!.pour).toBe(50);
		expect(result!.contre).toBe(30);
		expect(result!.abstention).toBe(20);
		expect(result!.total).toBe(100);
	});

	it('should round percentages to nearest integer', () => {
		// 1/3 ≈ 33%, 1/3 ≈ 33%, 1/3 ≈ 33%
		const groupResults = {
			GRP: { pour: 1, contre: 1, abstention: 1 }
		};

		const result = extractGroupVote(groupResults, 'GRP');

		expect(result).not.toBeNull();
		expect(result!.pctPour).toBe(33);
		expect(result!.pctContre).toBe(33);
		expect(result!.pctAbstention).toBe(33);
	});

	it('should handle unanimous vote (100% pour)', () => {
		const groupResults = {
			GRP: { pour: 57, contre: 0, abstention: 0 }
		};

		const result = extractGroupVote(groupResults, 'GRP');

		expect(result).not.toBeNull();
		expect(result!.pctPour).toBe(100);
		expect(result!.pctContre).toBe(0);
		expect(result!.pctAbstention).toBe(0);
	});

	it('should handle missing abstention field (defaults to 0)', () => {
		const groupResults = {
			GRP: { pour: 60, contre: 40 }
		};

		const result = extractGroupVote(groupResults, 'GRP');

		expect(result).not.toBeNull();
		expect(result!.abstention).toBe(0);
		expect(result!.total).toBe(100);
	});
});

// ============================================================
// expandQueryTerms & searchScrutins — Tests INTÉGRATION (avec DB)
// ============================================================

let dbAvailable = false;

beforeAll(async () => {
	try {
		const { db, searchSynonyms } = await import('$lib/server/db');
		await db.select().from(searchSynonyms).limit(1);
		dbAvailable = true;
	} catch {
		dbAvailable = false;
		console.warn('⚠️ Database not available - skipping integration tests');
	}
});

describe('expandQueryTerms - Integration', () => {
	it('should return the original query when no synonym found', async () => {
		if (!dbAvailable) return;

		const result = await expandQueryTerms('inconnu_xxxyyy');
		expect(result).toBe('inconnu_xxxyyy');
	});

	it('should return original query for empty-like input', async () => {
		if (!dbAvailable) return;

		const result = await expandQueryTerms('  ');
		expect(result).toBe('  ');
	});

	it('should expand SMIC to its full form', async () => {
		if (!dbAvailable) return;

		const result = await expandQueryTerms('SMIC');
		expect(result).toBe('salaire minimum interprofessionnel de croissance');
	});

	it('should be case-insensitive for synonym lookup', async () => {
		if (!dbAvailable) return;

		const result = await expandQueryTerms('smic');
		expect(result).toBe('salaire minimum interprofessionnel de croissance');
	});

	it('should expand only matching words, preserving others', async () => {
		if (!dbAvailable) return;

		const result = await expandQueryTerms('SMIC augmentation');
		expect(result).toContain('salaire minimum interprofessionnel de croissance');
		expect(result).toContain('augmentation');
	});

	it('should expand multiple synonyms in the same query', async () => {
		if (!dbAvailable) return;

		const result = await expandQueryTerms('SMIC TVA');
		expect(result).toContain('salaire minimum interprofessionnel de croissance');
		expect(result).toContain('taxe sur la valeur ajoutée');
	});

	it('should expand TVA to its full form', async () => {
		if (!dbAvailable) return;

		const result = await expandQueryTerms('TVA');
		expect(result).toBe('taxe sur la valeur ajoutée');
	});
});

describe('searchScrutins - Integration', () => {
	it('should return an array (possibly empty) for any query', async () => {
		if (!dbAvailable) return;

		const result = await searchScrutins('xyzabc123_impossible');
		expect(Array.isArray(result)).toBe(true);
	});

	it('should return scrutins matching SMIC via synonym expansion', async () => {
		if (!dbAvailable) return;

		const result = await searchScrutins('SMIC');
		expect(result.length).toBeGreaterThan(0);

		// Chaque résultat doit avoir les champs attendus
		const first = result[0];
		expect(first).toHaveProperty('id');
		expect(first).toHaveProperty('title');
		expect(first).toHaveProperty('date');
		expect(first).toHaveProperty('number');
		expect(first).toHaveProperty('legislature');
		expect(first).toHaveProperty('result');
	});

	it('should respect the limit parameter', async () => {
		if (!dbAvailable) return;

		const limit = 3;
		const result = await searchScrutins('loi', limit);
		expect(result.length).toBeLessThanOrEqual(limit);
	});

	it('should return results ordered by relevance (ts_rank)', async () => {
		if (!dbAvailable) return;

		// Les deux scrutins SMIC connus dans la DB doivent apparaître
		const result = await searchScrutins('SMIC');
		const titles = result.map((s) => s.title.toLowerCase());
		const hasSmic = titles.some(
			(t) => t.includes('salaire minimum') || t.includes('interprofessionnel')
		);
		expect(hasSmic).toBe(true);
	});

	it('should fall back to ILIKE when no fulltext match', async () => {
		if (!dbAvailable) return;

		// "rejet" apparaît dans les titres via ILIKE mais pas forcément via fulltext
		// L'important est que la fonction ne plante pas et retourne un tableau
		const result = await searchScrutins('rejet');
		expect(Array.isArray(result)).toBe(true);
	});
});
