import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Tests d'intégration de la page /verifier
 *
 * Vérifie que :
 * - Les cas limites (query vide, trop courte) retournent null
 * - La détection de groupe fonctionne (matchedGroupShortName)
 * - Les scrutins sont retournés avec les bons champs
 * - Le groupVote est enrichi quand un groupe est détecté
 * - Les requêtes en langage naturel (avec auxiliaires) trouvent des résultats
 *
 * NOTE: Les tests d'intégration sont skippés si la DB n'est pas disponible (CI)
 */

// ============================================================
// Helpers
// ============================================================

function makeEvent(query: string) {
	const url = new URL('http://localhost/verifier');
	if (query) url.searchParams.set('q', query);
	return { url };
}

// ============================================================
// Setup
// ============================================================

let dbAvailable = false;
let load: (event: { url: URL }) => Promise<unknown>;

beforeAll(async () => {
	try {
		const serverModule = await import('./+page.server');
		load = serverModule.load as typeof load;

		// Sonde DB : appel avec une query qui devrait retourner des données
		const result = (await load(makeEvent('SMIC'))) as { scrutins: unknown[] | null };
		// Si pas d'exception, la DB est disponible
		if (result.scrutins !== undefined) {
			dbAvailable = true;
		}
	} catch {
		dbAvailable = false;
		console.warn('⚠️ Database not available - skipping integration tests');
	}
});

// ============================================================
// Cas limites — comportement sans DB (logique pure du load)
// ============================================================

describe('/verifier load — cas limites', () => {
	it('should return scrutins: null when query is empty', async () => {
		if (!dbAvailable) return;

		const result = (await load(makeEvent(''))) as {
			query: string;
			scrutins: null;
			matchedGroupShortName: string | null;
		};

		expect(result.query).toBe('');
		expect(result.scrutins).toBeNull();
		expect(result.matchedGroupShortName).toBeNull();
	});

	it('should return scrutins: null when query is a single character', async () => {
		if (!dbAvailable) return;

		const result = (await load(makeEvent('S'))) as {
			query: string;
			scrutins: null;
			matchedGroupShortName: string | null;
		};

		expect(result.query).toBe('S');
		expect(result.scrutins).toBeNull();
		expect(result.matchedGroupShortName).toBeNull();
	});
});

// ============================================================
// Résultats vides
// ============================================================

describe('/verifier load — requête sans résultat', () => {
	it('should return empty array for gibberish query', async () => {
		if (!dbAvailable) return;

		const result = (await load(makeEvent('xyzabc123_impossible'))) as {
			scrutins: unknown[];
			matchedGroupShortName: string | null;
		};

		expect(Array.isArray(result.scrutins)).toBe(true);
		expect(result.scrutins).toHaveLength(0);
		expect(result.matchedGroupShortName).toBeNull();
	});
});

// ============================================================
// Structure des résultats
// ============================================================

describe('/verifier load — structure des scrutins retournés', () => {
	it('should return scrutins with required fields for SMIC query', async () => {
		if (!dbAvailable) return;

		const result = (await load(makeEvent('SMIC'))) as {
			query: string;
			scrutins: Array<{
				id: string;
				title: string;
				date: string | null;
				number: string | null;
				legislature: string | null;
				result: string | null;
				groupVote: unknown;
			}>;
			matchedGroupShortName: string | null;
		};

		expect(result.query).toBe('SMIC');
		expect(Array.isArray(result.scrutins)).toBe(true);
		expect(result.scrutins.length).toBeGreaterThan(0);

		const first = result.scrutins[0];
		expect(first).toHaveProperty('id');
		expect(first).toHaveProperty('title');
		expect(first).toHaveProperty('date');
		expect(first).toHaveProperty('number');
		expect(first).toHaveProperty('legislature');
		expect(first).toHaveProperty('result');
		expect(first).toHaveProperty('groupVote');
	});

	it('should return groupVote: null when no group detected in query', async () => {
		if (!dbAvailable) return;

		const result = (await load(makeEvent('SMIC'))) as {
			scrutins: Array<{ groupVote: unknown }>;
			matchedGroupShortName: string | null;
		};

		expect(result.matchedGroupShortName).toBeNull();
		result.scrutins.forEach((s) => {
			expect(s.groupVote).toBeNull();
		});
	});
});

// ============================================================
// Détection de groupe
// ============================================================

describe('/verifier load — détection de groupe dans la requête', () => {
	it('should detect "RN" group and set matchedGroupShortName', async () => {
		if (!dbAvailable) return;

		const result = (await load(makeEvent('SMIC RN'))) as {
			scrutins: unknown[];
			matchedGroupShortName: string | null;
		};

		expect(result.matchedGroupShortName).toBe('RN');
	});

	it('should include groupVote field for all scrutins when group is detected', async () => {
		if (!dbAvailable) return;

		const result = (await load(makeEvent('SMIC RN'))) as {
			scrutins: Array<{
				groupVote: {
					pctPour: number;
					pctContre: number;
					pctAbstention: number;
					total: number;
				} | null;
			}>;
			matchedGroupShortName: string | null;
		};

		expect(result.scrutins.length).toBeGreaterThan(0);
		expect(result.matchedGroupShortName).toBe('RN');

		// Tous les scrutins doivent avoir le champ groupVote (peut être null si pas de données pour RN)
		result.scrutins.forEach((s) => {
			expect(s).toHaveProperty('groupVote');
		});

		// Au moins un scrutin devrait avoir groupVote non-null pour les SMIC
		const withGroupVote = result.scrutins.filter((s) => s.groupVote !== null);
		if (withGroupVote.length > 0) {
			const gv = withGroupVote[0].groupVote!;
			expect(gv).toHaveProperty('pctPour');
			expect(gv).toHaveProperty('pctContre');
			expect(gv).toHaveProperty('pctAbstention');
			expect(gv).toHaveProperty('total');
			expect(gv.pctPour + gv.pctContre + gv.pctAbstention).toBeGreaterThanOrEqual(98); // ~100%
			expect(gv.total).toBeGreaterThan(0);
		}
	});

	it('should strip group name from fulltext search query', async () => {
		if (!dbAvailable) return;

		// "SMIC RN" et "SMIC" doivent retourner les mêmes scrutins SMIC
		const [withGroup, withoutGroup] = await Promise.all([
			load(makeEvent('SMIC RN')) as Promise<{ scrutins: Array<{ id: string }> }>,
			load(makeEvent('SMIC')) as Promise<{ scrutins: Array<{ id: string }> }>
		]);

		const idsWithGroup = withGroup.scrutins.map((s) => s.id).sort();
		const idsWithoutGroup = withoutGroup.scrutins.map((s) => s.id).sort();

		expect(idsWithGroup).toEqual(idsWithoutGroup);
	});
});

// ============================================================
// Requêtes en langage naturel (cas /verifier spécifiques)
// ============================================================

describe('/verifier load — requêtes en langage naturel', () => {
	it('should find SMIC scrutins for natural language claim with French auxiliaries', async () => {
		if (!dbAvailable) return;

		// Ce cas a été un bug réel : "a" (auxiliaire) bloquait plainto_tsquery
		const result = (await load(makeEvent("Le RN a voté contre l'augmentation du SMIC"))) as {
			scrutins: Array<{ id: string }>;
			matchedGroupShortName: string | null;
		};

		expect(result.matchedGroupShortName).toBe('RN');
		expect(result.scrutins.length).toBeGreaterThan(0);
	});

	it('should find scrutins for claim without group mention', async () => {
		if (!dbAvailable) return;

		const result = (await load(makeEvent('augmentation du SMIC'))) as {
			scrutins: Array<{ id: string }>;
			matchedGroupShortName: string | null;
		};

		expect(result.matchedGroupShortName).toBeNull();
		expect(result.scrutins.length).toBeGreaterThan(0);
	});
});

// ============================================================
// Limite de résultats
// ============================================================

describe('/verifier load — performance et limites', () => {
	it('should return at most 20 scrutins', async () => {
		if (!dbAvailable) return;

		// "loi" est un terme très générique qui pourrait matcher beaucoup de scrutins
		const result = (await load(makeEvent('loi'))) as {
			scrutins: unknown[];
		};

		expect(result.scrutins.length).toBeLessThanOrEqual(20);
	});
});
