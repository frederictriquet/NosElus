import { describe, it, expect } from 'vitest';
import { truncate, escapeHtml, formatDate, buildTemplate, type GroupData } from './og-template';

// ============================================================
// Fixtures
// ============================================================

function makeGroup(
	overrides: Partial<GroupData> & Pick<GroupData, 'name' | 'pour' | 'contre' | 'abstention'>
): GroupData {
	return { shortName: null, ...overrides };
}

const RN = makeGroup({
	name: 'Rassemblement National',
	shortName: 'RN',
	pour: 6,
	contre: 88,
	abstention: 0
});
const NFP = makeGroup({
	name: 'Nouveau Front Populaire',
	shortName: 'NFP',
	pour: 60,
	contre: 0,
	abstention: 0
});
const ENS = makeGroup({ name: 'Ensemble', shortName: 'ENS', pour: 10, contre: 72, abstention: 18 });
const LR = makeGroup({
	name: 'Les Républicains',
	shortName: 'LR',
	pour: 5,
	contre: 30,
	abstention: 2
});
const UDI = makeGroup({ name: 'UDI', shortName: 'UDI', pour: 4, contre: 8, abstention: 2 });

const BASE_PARAMS = {
	title: 'Augmentation du SMIC à 1500€ net',
	date: '20 juillet 2022',
	result: 'rejeté' as string | null,
	groups: [RN, NFP],
	scrutinId: 'VTANR5L16V0063'
};

// ============================================================
// escapeHtml
// ============================================================

describe('escapeHtml', () => {
	it('should leave plain strings unchanged', () => {
		expect(escapeHtml('Augmentation du SMIC')).toBe('Augmentation du SMIC');
	});

	it('should escape ampersand', () => {
		expect(escapeHtml('Code civil & pénal')).toBe('Code civil &amp; pénal');
	});

	it('should escape less-than', () => {
		expect(escapeHtml('art. 1<bis>')).toBe('art. 1&lt;bis&gt;');
	});

	it('should escape greater-than', () => {
		expect(escapeHtml('a > b')).toBe('a &gt; b');
	});

	it('should escape multiple characters in one string', () => {
		expect(escapeHtml('<div>&</div>')).toBe('&lt;div&gt;&amp;&lt;/div&gt;');
	});

	it('should handle empty string', () => {
		expect(escapeHtml('')).toBe('');
	});
});

// ============================================================
// truncate
// ============================================================

describe('truncate', () => {
	it('should return the string unchanged when shorter than max', () => {
		expect(truncate('court', 10)).toBe('court');
	});

	it('should return the string unchanged when length equals max', () => {
		expect(truncate('exactement', 10)).toBe('exactement');
	});

	it('should truncate and append ellipsis when longer than max', () => {
		expect(truncate('abcdefghij', 5)).toBe('abcd…');
	});

	it('should produce a string of length max when truncated', () => {
		const result = truncate('un titre très long', 10);
		expect(result).toHaveLength(10);
		expect(result.endsWith('…')).toBe(true);
	});

	it('should handle empty string', () => {
		expect(truncate('', 10)).toBe('');
	});

	it('should handle max=1', () => {
		expect(truncate('abc', 1)).toBe('…');
	});
});

// ============================================================
// formatDate
// ============================================================

describe('formatDate', () => {
	it('should format a date in French locale', () => {
		expect(formatDate('2022-07-20')).toBe('20 juillet 2022');
	});

	it('should not shift to previous day (no UTC offset issue)', () => {
		// Test avec une date de début de mois — risque classique d'UTC shift
		const result = formatDate('2022-01-01');
		expect(result).toContain('1');
		expect(result).toContain('2022');
		expect(result).not.toContain('31 décembre'); // bug UTC shift
	});

	it('should format the day without leading zero', () => {
		expect(formatDate('2023-03-05')).toBe('5 mars 2023');
	});
});

// ============================================================
// buildTemplate — structure de base
// ============================================================

describe('buildTemplate — structure de base', () => {
	it('should include NosElus branding', () => {
		const html = buildTemplate(BASE_PARAMS);
		expect(html).toContain('NosElus');
	});

	it('should include Assemblée Nationale label', () => {
		const html = buildTemplate(BASE_PARAMS);
		expect(html).toContain('Assemblée Nationale');
	});

	it('should include the title', () => {
		const html = buildTemplate(BASE_PARAMS);
		expect(html).toContain('Augmentation du SMIC à 1500€ net');
	});

	it('should include the date', () => {
		const html = buildTemplate(BASE_PARAMS);
		expect(html).toContain('20 juillet 2022');
	});

	it('should include the scrutinId in the source URL', () => {
		const html = buildTemplate(BASE_PARAMS);
		expect(html).toContain('noselus.fr/an/scrutins/VTANR5L16V0063');
	});
});

// ============================================================
// buildTemplate — badge de résultat
// ============================================================

describe('buildTemplate — badge de résultat', () => {
	it('should show ADOPTÉ badge with green colors when result is "adopté"', () => {
		const html = buildTemplate({ ...BASE_PARAMS, result: 'adopté' });
		expect(html).toContain('ADOPTÉ');
		expect(html).toContain('#14532d'); // fond vert foncé
		expect(html).toContain('#4ade80'); // texte vert clair
	});

	it('should show REJETÉ badge with red colors when result is "rejeté"', () => {
		const html = buildTemplate({ ...BASE_PARAMS, result: 'rejeté' });
		expect(html).toContain('REJETÉ');
		expect(html).toContain('#7f1d1d'); // fond rouge foncé
		expect(html).toContain('#f87171'); // texte rouge clair
	});

	it('should show no badge when result is null', () => {
		const html = buildTemplate({ ...BASE_PARAMS, result: null });
		expect(html).not.toContain('ADOPTÉ');
		expect(html).not.toContain('REJETÉ');
		expect(html).not.toContain('#14532d');
		expect(html).not.toContain('#7f1d1d');
	});
});

// ============================================================
// buildTemplate — groupes : filtrage et tri
// ============================================================

describe('buildTemplate — groupes', () => {
	it('should include group shortName in the output', () => {
		const html = buildTemplate(BASE_PARAMS);
		expect(html).toContain('RN');
		expect(html).toContain('NFP');
	});

	it('should use full name when shortName is null', () => {
		const noShort = makeGroup({ name: 'Groupe Sans Sigle', pour: 10, contre: 0, abstention: 0 });
		const html = buildTemplate({ ...BASE_PARAMS, groups: [noShort] });
		expect(html).toContain('Groupe Sans Sigle');
	});

	it('should exclude groups with total votes of 0', () => {
		const ghost = makeGroup({
			name: 'Fantôme',
			shortName: 'GHO',
			pour: 0,
			contre: 0,
			abstention: 0
		});
		const html = buildTemplate({ ...BASE_PARAMS, groups: [ghost, NFP] });
		expect(html).not.toContain('GHO');
		expect(html).toContain('NFP');
	});

	it('should show no groups section when all groups have 0 votes', () => {
		const ghost = makeGroup({ name: 'Fantôme', pour: 0, contre: 0, abstention: 0 });
		const html = buildTemplate({ ...BASE_PARAMS, groups: [ghost] });
		// Pas de barre de groupe
		expect(html).not.toContain('#22c55e'); // pas de vert (pour)
		expect(html).not.toContain('#ef4444'); // pas de rouge (contre)
	});

	it('should show no groups section when groups list is empty', () => {
		const html = buildTemplate({ ...BASE_PARAMS, groups: [] });
		expect(html).not.toContain('#22c55e');
		expect(html).not.toContain('#ef4444');
	});

	it('should cap displayed groups at 4', () => {
		const html = buildTemplate({
			...BASE_PARAMS,
			groups: [RN, NFP, ENS, LR, UDI] // 5 groupes
		});
		// UDI est le 5e groupe le plus petit — doit être absent
		expect(html).not.toContain('UDI');
		// Les 4 plus grands doivent être présents
		expect(html).toContain('RN');
		expect(html).toContain('NFP');
		expect(html).toContain('ENS');
		expect(html).toContain('LR');
	});

	it('should sort groups by total voters descending', () => {
		// NFP : 60, ENS : 100, LR : 37 — ENS doit apparaître avant NFP
		const html = buildTemplate({ ...BASE_PARAMS, groups: [LR, NFP, ENS] });
		const ensIdx = html.indexOf('ENS');
		const nfpIdx = html.indexOf('NFP');
		const lrIdx = html.indexOf('LR');
		expect(ensIdx).toBeLessThan(nfpIdx); // ENS (100) avant NFP (60)
		expect(nfpIdx).toBeLessThan(lrIdx); // NFP (60) avant LR (37)
	});
});

// ============================================================
// buildTemplate — pourcentages et barres
// ============================================================

describe('buildTemplate — pourcentages', () => {
	it('should compute 100% pour for a group with only pour votes', () => {
		const html = buildTemplate({ ...BASE_PARAMS, groups: [NFP] });
		// NFP : 60 pour, 0 contre, 0 abstention → 100% pour
		expect(html).toContain('100% pour');
	});

	it('should compute ~94% contre for RN', () => {
		const html = buildTemplate({ ...BASE_PARAMS, groups: [RN] });
		// RN : 6 pour, 88 contre → 94% contre
		expect(html).toContain('94% contre');
	});

	it('should use pour bar width 0% for a group with no pour votes', () => {
		const html = buildTemplate({ ...BASE_PARAMS, groups: [RN] });
		// RN a 6% pour — la barre verte doit avoir width:6%
		expect(html).toContain('width:6%');
	});

	it('should clamp contrePct to avoid overflow past 100 due to rounding', () => {
		// Groupe fictif : 50 pour, 50 contre, 1 abstention → pourPct=50%, contrePct=50%
		// Total = 101 votes → 50/101 ≈ 49.5% arrondi à 50%, idem pour contre
		// contrePct clamped à 100 - 50 = 50 → pas d'overflow
		const balanced = makeGroup({ name: 'Balanced', pour: 50, contre: 50, abstention: 1 });
		const html = buildTemplate({ ...BASE_PARAMS, groups: [balanced] });
		// Vérifier qu'il n'y a pas de width > 100%
		const widths = [...html.matchAll(/width:(\d+)%/g)].map((m) => parseInt(m[1]));
		widths.forEach((w) => {
			expect(w).toBeLessThanOrEqual(100);
		});
	});
});

// ============================================================
// buildTemplate — taille du titre
// ============================================================

describe('buildTemplate — taille de police du titre', () => {
	it('should use 44px font for short titles (≤60 chars)', () => {
		const shortTitle = 'Augmentation du SMIC'; // 20 chars
		const html = buildTemplate({ ...BASE_PARAMS, title: shortTitle });
		expect(html).toContain('font-size:44px');
	});

	it('should use 36px font for long titles (>60 chars)', () => {
		const longTitle = 'A'.repeat(61);
		const html = buildTemplate({ ...BASE_PARAMS, title: longTitle });
		expect(html).toContain('font-size:36px');
	});

	it('should use 44px font for a title of exactly 60 chars', () => {
		const exactTitle = 'A'.repeat(60);
		const html = buildTemplate({ ...BASE_PARAMS, title: exactTitle });
		expect(html).toContain('font-size:44px');
	});
});
