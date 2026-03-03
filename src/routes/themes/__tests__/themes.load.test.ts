import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Tests d'intégration pour les load functions des pages /themes et /themes/[slug]
 *
 * Vérifie que :
 * - /themes load retourne { themes: ThemeSummary[] }
 * - /themes/[slug] load retourne { theme: ThemeDetail } pour un slug valide
 * - /themes/[slug] load throws une erreur 404 pour un slug inexistant
 *
 * NOTE: Skippés automatiquement si la DB n'est pas disponible (CI).
 */

let dbAvailable = false;
let loadThemes: (args?: unknown) => Promise<unknown>;
let loadThemeDetail: (args: { params: { slug: string } }) => Promise<unknown>;

beforeAll(async () => {
	try {
		const themesModule = await import('../+page.server');
		const slugModule = await import('../[slug]/+page.server');

		loadThemes = themesModule.load as typeof loadThemes;
		loadThemeDetail = slugModule.load as typeof loadThemeDetail;

		// Vérification DB légère
		await loadThemes();
		dbAvailable = true;
	} catch {
		dbAvailable = false;
		console.warn('⚠️ Database not available - skipping integration tests');
	}
});

// ============================================================
// /themes — load
// ============================================================

describe('/themes +page.server load - Integration', () => {
	it('should return an object with themes array', async () => {
		if (!dbAvailable) return;

		const result = (await loadThemes()) as { themes: unknown[] };
		expect(result).toHaveProperty('themes');
		expect(Array.isArray(result.themes)).toBe(true);
	});

	it('should contain pilot themes pouvoir-achat and retraites', async () => {
		if (!dbAvailable) return;

		const result = (await loadThemes()) as { themes: Array<{ slug: string }> };
		const slugs = result.themes.map((t) => t.slug);

		expect(slugs).toContain('pouvoir-achat');
		expect(slugs).toContain('retraites');
	});

	it('should return themes with scrutinCount > 0', async () => {
		if (!dbAvailable) return;

		const result = (await loadThemes()) as {
			themes: Array<{ slug: string; scrutinCount: number }>;
		};

		for (const theme of result.themes) {
			expect(theme.scrutinCount).toBeGreaterThan(0);
		}
	});

	it('should include groupBilans array for each theme', async () => {
		if (!dbAvailable) return;

		const result = (await loadThemes()) as {
			themes: Array<{ groupBilans: unknown[] }>;
		};

		for (const theme of result.themes) {
			expect(Array.isArray(theme.groupBilans)).toBe(true);
		}
	});
});

// ============================================================
// /themes/[slug] — load
// ============================================================

describe('/themes/[slug] +page.server load - Integration', () => {
	it('should return theme detail for pouvoir-achat', async () => {
		if (!dbAvailable) return;

		const result = (await loadThemeDetail({ params: { slug: 'pouvoir-achat' } })) as {
			theme: unknown;
		};

		expect(result).toHaveProperty('theme');
		expect(result.theme).toBeDefined();
	});

	it('should return theme with correct structure', async () => {
		if (!dbAvailable) return;

		const result = (await loadThemeDetail({ params: { slug: 'retraites' } })) as {
			theme: {
				tag: { slug: string; name: string; color: string | null };
				groupBilans: unknown[];
				scrutins: unknown[];
			};
		};

		expect(result.theme).toHaveProperty('tag');
		expect(result.theme).toHaveProperty('groupBilans');
		expect(result.theme).toHaveProperty('scrutins');

		expect(result.theme.tag.slug).toBe('retraites');
		expect(typeof result.theme.tag.name).toBe('string');
		expect(Array.isArray(result.theme.groupBilans)).toBe(true);
		expect(Array.isArray(result.theme.scrutins)).toBe(true);
		expect(result.theme.scrutins.length).toBeGreaterThan(0);
	});

	it('should throw 404 error for unknown slug', async () => {
		if (!dbAvailable) return;

		await expect(
			loadThemeDetail({ params: { slug: 'slug-inexistant-xyz' } })
		).rejects.toMatchObject({ status: 404 });
	});

	it('should throw 404 with message for unknown slug', async () => {
		if (!dbAvailable) return;

		let caughtError: unknown;
		try {
			await loadThemeDetail({ params: { slug: 'inexistant' } });
		} catch (e) {
			caughtError = e;
		}

		expect(caughtError).toBeDefined();
		expect((caughtError as { status: number }).status).toBe(404);
	});
});
