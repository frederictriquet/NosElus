import { describe, it, expect } from 'vitest';
import { formatVoteCard, type VoteCardGroup, type VoteCardScrutin } from './vote-card';

// ============================================================
// Fixtures
// ============================================================

const scrutin: VoteCardScrutin = {
	id: 'VTANR5L16V0063',
	title: 'PPL visant à instituer une augmentation du SMIC',
	titleSimple: null,
	date: '2022-07-20'
};

function makeGroup(
	overrides: Partial<VoteCardGroup> & Pick<VoteCardGroup, 'name' | 'pour' | 'contre' | 'abstention'>
): VoteCardGroup {
	return { shortName: null, ...overrides };
}

const RN = makeGroup({ name: 'Rassemblement National', shortName: 'RN', pour: 6, contre: 88, abstention: 0 });
const NFP = makeGroup({ name: 'Nouveau Front Populaire', shortName: 'NFP', pour: 60, contre: 0, abstention: 0 });
const ENS = makeGroup({ name: 'Ensemble', shortName: 'ENS', pour: 10, contre: 72, abstention: 18 });

// ============================================================
// Titre — fallback titleSimple / title
// ============================================================

describe('formatVoteCard — titre', () => {
	it('should use titleSimple when provided', () => {
		const s = { ...scrutin, titleSimple: 'Augmentation du SMIC à 1500€ net' };
		const result = formatVoteCard(s, [NFP]);
		expect(result).toContain('📊 VOTE : Augmentation du SMIC à 1500€ net');
	});

	it('should fall back to title when titleSimple is null', () => {
		const result = formatVoteCard(scrutin, [NFP]);
		expect(result).toContain('📊 VOTE : PPL visant à instituer une augmentation du SMIC');
	});
});

// ============================================================
// Date — format français
// ============================================================

describe('formatVoteCard — date', () => {
	it('should format date in French locale', () => {
		const result = formatVoteCard(scrutin, [NFP]);
		expect(result).toContain('20 juillet 2022 — Assemblée Nationale');
	});
});

// ============================================================
// URL source
// ============================================================

describe('formatVoteCard — source', () => {
	it('should include scrutin id in source URL', () => {
		const result = formatVoteCard(scrutin, [NFP]);
		expect(result).toContain('Source : nosElus.fr/an/scrutins/VTANR5L16V0063');
	});
});

// ============================================================
// Positions — cas nominal
// ============================================================

describe('formatVoteCard — positions', () => {
	it('should list groups in Pour line when they have pour > 0', () => {
		const result = formatVoteCard(scrutin, [NFP, RN]);
		expect(result).toContain('✅ Pour       : NFP (100%)');
	});

	it('should list groups in Contre line when they have contre > 0', () => {
		const result = formatVoteCard(scrutin, [NFP, RN]);
		expect(result).toContain('❌ Contre     : RN (94%)');
	});

	it('should show abstention groups when they have abstention > 0', () => {
		const abstGroup = makeGroup({ name: 'Groupe A', shortName: 'GA', pour: 0, contre: 0, abstention: 50 });
		const result = formatVoteCard(scrutin, [abstGroup]);
		expect(result).toContain('🟡 Abstention : GA (100%)');
	});
});

// ============================================================
// Positions vides — affichage "—"
// ============================================================

describe('formatVoteCard — positions vides', () => {
	it('should show "—" for Pour when no group voted for', () => {
		const onlyAgainst = makeGroup({ name: 'Groupe X', shortName: 'GX', pour: 0, contre: 50, abstention: 0 });
		const result = formatVoteCard(scrutin, [onlyAgainst]);
		expect(result).toContain('✅ Pour       : —');
	});

	it('should show "—" for Contre when no group voted against', () => {
		const result = formatVoteCard(scrutin, [NFP]); // NFP a seulement pour
		expect(result).toContain('❌ Contre     : —');
	});

	it('should show "—" for Abstention when no group abstained', () => {
		const result = formatVoteCard(scrutin, [NFP, RN]); // aucune abstention
		expect(result).toContain('🟡 Abstention : —');
	});

	it('should show "—" for all positions when groups list is empty', () => {
		const result = formatVoteCard(scrutin, []);
		expect(result).toContain('✅ Pour       : —');
		expect(result).toContain('❌ Contre     : —');
		expect(result).toContain('🟡 Abstention : —');
	});
});

// ============================================================
// Tri par % décroissant
// ============================================================

describe('formatVoteCard — tri des groupes par % décroissant', () => {
	it('should sort Pour groups by descending percentage', () => {
		// NFP : 100%, ENS : 10/100 = 10%
		const result = formatVoteCard(scrutin, [ENS, NFP]);
		const pourLine = result.split('\n').find((l) => l.startsWith('✅'));
		expect(pourLine).toBeDefined();
		const nfpIndex = pourLine!.indexOf('NFP');
		const ensIndex = pourLine!.indexOf('ENS');
		expect(nfpIndex).toBeLessThan(ensIndex); // NFP avant ENS
	});

	it('should sort Contre groups by descending percentage', () => {
		// RN contre : 94%, ENS contre : 72%
		const result = formatVoteCard(scrutin, [ENS, RN]);
		const contreLine = result.split('\n').find((l) => l.startsWith('❌'));
		expect(contreLine).toBeDefined();
		const rnIndex = contreLine!.indexOf('RN');
		const ensIndex = contreLine!.indexOf('ENS');
		expect(rnIndex).toBeLessThan(ensIndex); // RN avant ENS
	});
});

// ============================================================
// Nom affiché — shortName vs name
// ============================================================

describe('formatVoteCard — affichage du nom du groupe', () => {
	it('should use shortName when available', () => {
		const result = formatVoteCard(scrutin, [NFP]); // shortName = 'NFP'
		expect(result).toContain('NFP');
		expect(result).not.toContain('Nouveau Front Populaire');
	});

	it('should fall back to name when shortName is null', () => {
		const noShortName = makeGroup({ name: 'Groupe Sans Sigle', pour: 10, contre: 0, abstention: 0 });
		const result = formatVoteCard(scrutin, [noShortName]);
		expect(result).toContain('Groupe Sans Sigle');
	});
});

// ============================================================
// Groupes à total 0 — ignorés
// ============================================================

describe('formatVoteCard — groupes à total zéro', () => {
	it('should not include groups with all-zero votes in any position', () => {
		const ghost = makeGroup({ name: 'Fantôme', shortName: 'GHO', pour: 0, contre: 0, abstention: 0 });
		const result = formatVoteCard(scrutin, [ghost, NFP]);
		expect(result).not.toContain('GHO');
		expect(result).toContain('NFP');
	});
});

// ============================================================
// Format global
// ============================================================

describe('formatVoteCard — format global', () => {
	it('should produce the expected multiline format', () => {
		const s = { ...scrutin, titleSimple: 'Augmentation du SMIC à 1500€ net' };
		const result = formatVoteCard(s, [NFP, RN]);
		const lines = result.split('\n');

		expect(lines[0]).toMatch(/^📊 VOTE : /);
		expect(lines[1]).toMatch(/^📅 .+ — Assemblée Nationale$/);
		expect(lines[2]).toBe('');
		expect(lines[3]).toMatch(/^✅ Pour       : /);
		expect(lines[4]).toMatch(/^❌ Contre     : /);
		expect(lines[5]).toMatch(/^🟡 Abstention : /);
		expect(lines[6]).toBe('');
		expect(lines[7]).toMatch(/^Source : nosElus\.fr\/an\/scrutins\//);
	});
});
