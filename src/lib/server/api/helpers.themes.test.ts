import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getThemesWithBilan, getThemeDetail } from './helpers';

/**
 * Tests d'intégration pour les fonctions de fiches thématiques.
 *
 * Vérifie que :
 * - getThemesWithBilan() retourne les thèmes actifs avec leur bilan de vote
 * - getThemeDetail(slug) retourne le détail complet ou null si inexistant
 * - Les invariants métier sont respectés (pourcentages, seuils, tri)
 *
 * NOTE: Skippés automatiquement si la DB n'est pas disponible (CI).
 * Les tags 'pouvoir-achat' et 'retraites' doivent exister en DB (migration 0019).
 */

let dbAvailable = false;

beforeAll(async () => {
	try {
		const { db } = await import('$lib/server/db');
		// Vérification légère : juste tester la connexion
		await db.execute('SELECT 1');
		dbAvailable = true;
	} catch {
		dbAvailable = false;
		console.warn('⚠️ Database not available - skipping integration tests');
	}
});

beforeEach((context) => {
	if (!dbAvailable) context.skip();
});

// ============================================================
// getThemesWithBilan
// ============================================================

describe('getThemesWithBilan - Integration', () => {
	it('should return an array', async () => {
		const result = await getThemesWithBilan();
		expect(Array.isArray(result)).toBe(true);
	});

	it('should contain only themes with at least one scrutin', async () => {
		const result = await getThemesWithBilan();
		for (const theme of result) {
			expect(theme.scrutinCount).toBeGreaterThan(0);
		}
	});

	it('should return themes with required fields', async () => {
		const result = await getThemesWithBilan();
		if (result.length === 0) {
			console.warn('No themes in DB, skipping structure check');
			return;
		}

		const theme = result[0];
		expect(theme).toHaveProperty('slug');
		expect(theme).toHaveProperty('name');
		expect(theme).toHaveProperty('color');
		expect(theme).toHaveProperty('scrutinCount');
		expect(theme).toHaveProperty('groupBilans');

		expect(typeof theme.slug).toBe('string');
		expect(typeof theme.name).toBe('string');
		expect(typeof theme.scrutinCount).toBe('number');
		expect(Array.isArray(theme.groupBilans)).toBe(true);
	});

	it('should include pouvoir-achat and retraites (pilot tags)', async () => {
		const result = await getThemesWithBilan();
		const slugs = result.map((t) => t.slug);

		expect(slugs).toContain('pouvoir-achat');
		expect(slugs).toContain('retraites');
	});

	it('should order themes by scrutin count descending', async () => {
		const result = await getThemesWithBilan();
		if (result.length < 2) return;

		for (let i = 0; i < result.length - 1; i++) {
			expect(result[i].scrutinCount).toBeGreaterThanOrEqual(result[i + 1].scrutinCount);
		}
	});

	it('should have valid groupBilans structure when present', async () => {
		const result = await getThemesWithBilan();
		const themeWithBilans = result.find((t) => t.groupBilans.length > 0);
		if (!themeWithBilans) {
			console.warn('No theme with groupBilans, skipping structure check');
			return;
		}

		const bilan = themeWithBilans.groupBilans[0];
		expect(bilan).toHaveProperty('groupId');
		expect(bilan).toHaveProperty('shortName');
		expect(bilan).toHaveProperty('color');
		expect(bilan).toHaveProperty('scrutinsPour');
		expect(bilan).toHaveProperty('scrutinsContre');
		expect(bilan).toHaveProperty('scrutinsAbstention');
		expect(bilan).toHaveProperty('totalScrutins');

		expect(typeof bilan.groupId).toBe('string');
		expect(typeof bilan.shortName).toBe('string');
		expect(typeof bilan.scrutinsPour).toBe('number');
		expect(typeof bilan.scrutinsContre).toBe('number');
		expect(typeof bilan.scrutinsAbstention).toBe('number');
		expect(typeof bilan.totalScrutins).toBe('number');
	});

	it('should respect groupBilan invariant: sum of positions <= totalScrutins', async () => {
		const result = await getThemesWithBilan();
		for (const theme of result) {
			for (const bilan of theme.groupBilans) {
				const sum = bilan.scrutinsPour + bilan.scrutinsContre + bilan.scrutinsAbstention;
				expect(sum).toBe(bilan.totalScrutins);
			}
		}
	});

	it('should respect threshold: groupBilans only for groups in >= half of scrutins', async () => {
		const result = await getThemesWithBilan();
		for (const theme of result) {
			const threshold = Math.ceil(theme.scrutinCount / 2);
			for (const bilan of theme.groupBilans) {
				expect(bilan.totalScrutins).toBeGreaterThanOrEqual(threshold);
			}
		}
	});
});

// ============================================================
// getThemeDetail
// ============================================================

describe('getThemeDetail - Integration', () => {
	it('should return null for unknown slug', async () => {
		const result = await getThemeDetail('tag-inexistant-xyz123');
		expect(result).toBeNull();
	});

	it('should return null for empty string', async () => {
		const result = await getThemeDetail('');
		expect(result).toBeNull();
	});

	it('should return ThemeDetail for pouvoir-achat', async () => {
		const result = await getThemeDetail('pouvoir-achat');
		expect(result).not.toBeNull();
	});

	it('should return ThemeDetail for retraites', async () => {
		const result = await getThemeDetail('retraites');
		expect(result).not.toBeNull();
	});

	it('should return correct tag fields', async () => {
		const result = await getThemeDetail('pouvoir-achat');
		if (!result) return;

		expect(result.tag.slug).toBe('pouvoir-achat');
		expect(result.tag.name).toBe("Pouvoir d'achat");
		expect(typeof result.tag.color).toBe('string');
	});

	it('should return scrutins with required fields', async () => {
		const result = await getThemeDetail('pouvoir-achat');
		if (!result) return;

		expect(Array.isArray(result.scrutins)).toBe(true);
		expect(result.scrutins.length).toBeGreaterThan(0);

		const scrutin = result.scrutins[0];
		expect(scrutin).toHaveProperty('id');
		expect(scrutin).toHaveProperty('title');
		expect(scrutin).toHaveProperty('date');
		expect(scrutin).toHaveProperty('result');

		expect(typeof scrutin.id).toBe('string');
		expect(typeof scrutin.title).toBe('string');
	});

	it('should order scrutins by date descending', async () => {
		const result = await getThemeDetail('pouvoir-achat');
		if (!result || result.scrutins.length < 2) return;

		for (let i = 0; i < result.scrutins.length - 1; i++) {
			const dateA = new Date(result.scrutins[i].date).getTime();
			const dateB = new Date(result.scrutins[i + 1].date).getTime();
			expect(dateA).toBeGreaterThanOrEqual(dateB);
		}
	});

	it('should return groupBilans array', async () => {
		const result = await getThemeDetail('pouvoir-achat');
		if (!result) return;

		expect(Array.isArray(result.groupBilans)).toBe(true);
	});

	it('should respect groupBilan invariant: sum of positions == totalScrutins', async () => {
		const result = await getThemeDetail('pouvoir-achat');
		if (!result) return;

		for (const bilan of result.groupBilans) {
			const sum = bilan.scrutinsPour + bilan.scrutinsContre + bilan.scrutinsAbstention;
			expect(sum).toBe(bilan.totalScrutins);
			expect(bilan.totalScrutins).toBeGreaterThan(0);
		}
	});

	it('should have consistent data: groupBilan.totalScrutins <= scrutins.length', async () => {
		const result = await getThemeDetail('retraites');
		if (!result) return;

		for (const bilan of result.groupBilans) {
			expect(bilan.totalScrutins).toBeLessThanOrEqual(result.scrutins.length);
		}
	});
});
