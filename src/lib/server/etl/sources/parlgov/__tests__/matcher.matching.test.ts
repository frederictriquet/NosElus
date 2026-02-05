import { describe, it, expect } from 'vitest';
import { findBestMatch, matchAll } from '../matcher';
import { createTestOrgan, createTestParlGovParty, realOrgans, parlGovParties } from './fixtures';

describe('ParlGov Matcher - Best Match', () => {
	describe('findBestMatch', () => {
		it('should return null for Non-inscrit groups', () => {
			const organ = realOrgans.ni;
			const parties = [parlGovParties.lfi, parlGovParties.rn];

			const result = findBestMatch(organ, parties);

			expect(result).toBeNull();
		});

		it('should match by shortName vs shortName (exact)', () => {
			const organ = createTestOrgan({
				name: 'La France Insoumise',
				shortName: 'LFI'
			});
			const parties = [parlGovParties.lfi, parlGovParties.rn];

			const result = findBestMatch(organ, parties);

			expect(result).not.toBeNull();
			expect(result?.parlGovParty.shortName).toBe(parlGovParties.lfi.shortName);
			expect(result?.matchedOn).toBe('shortName');
		});

		it('should match by name vs nameNative', () => {
			const organ = createTestOrgan({
				name: 'Rassemblement national',
				shortName: 'XYZ' // ShortName différent
			});
			const parties = [parlGovParties.rn];

			const result = findBestMatch(organ, parties);

			expect(result).not.toBeNull();
			expect(result?.parlGovParty.shortName).toBe(parlGovParties.rn.shortName);
			expect(result?.matchedOn).toBe('nameNative');
		});

		it('should match by name vs nameEnglish', () => {
			const organ = createTestOrgan({
				name: 'National Rally',
				shortName: null
			});
			const parties = [parlGovParties.rn];

			const result = findBestMatch(organ, parties);

			expect(result).not.toBeNull();
			expect(result?.matchedOn).toBe('nameEnglish');
		});

		it('should match by shortName vs nameNative (fallback)', () => {
			const organ = createTestOrgan({
				name: 'Other Name',
				shortName: 'Parti socialiste'
			});
			const parties = [parlGovParties.ps];

			const result = findBestMatch(organ, parties);

			expect(result).not.toBeNull();
			expect(result?.parlGovParty.shortName).toBe(parlGovParties.ps.shortName);
		});

		it('should return null when score below threshold', () => {
			const organ = createTestOrgan({
				name: 'Completely Different Party',
				shortName: 'CDP'
			});
			const parties = [parlGovParties.lfi];

			const result = findBestMatch(organ, parties);

			expect(result).toBeNull();
		});

		it('should respect custom threshold', () => {
			const organ = createTestOrgan({
				name: 'Completely Different Name', // Aucune similarité
				shortName: 'CDN'
			});
			const parties = [parlGovParties.lfi];

			// Threshold par défaut (0.4) → pas de match
			const result1 = findBestMatch(organ, parties);
			expect(result1).toBeNull();

			// Threshold très bas (0.1) → toujours pas de match (aucune similarité)
			const result2 = findBestMatch(organ, parties, { threshold: 0.1 });
			expect(result2).toBeNull();
		});

		it('should return best match among multiple candidates', () => {
			const organ = createTestOrgan({
				name: 'Les Républicains',
				shortName: 'LR'
			});
			const parties = [
				parlGovParties.lfi, // Mauvais match
				parlGovParties.lr, // Bon match
				parlGovParties.rn // Mauvais match
			];

			const result = findBestMatch(organ, parties);

			expect(result).not.toBeNull();
			expect(result?.parlGovParty.shortName).toBe(parlGovParties.lr.shortName);
		});

		it('should prioritize shortName match over name match', () => {
			const organ = createTestOrgan({
				name: 'Socialist Party Long Name',
				shortName: 'LR' // Match exact avec LR
			});
			const parties = [parlGovParties.lr, parlGovParties.ps];

			const result = findBestMatch(organ, parties);

			// LR devrait gagner car shortName exact
			expect(result?.parlGovParty.shortName).toBe(parlGovParties.lr.shortName);
		});

		it('should return match result with correct structure', () => {
			const organ = realOrgans.lfi;
			const parties = [parlGovParties.lfi];

			const result = findBestMatch(organ, parties);

			expect(result).toMatchObject({
				organId: organ.id,
				organName: organ.name,
				organShortName: organ.shortName,
				parlGovParty: expect.objectContaining({
					shortName: parlGovParties.lfi.shortName
				}),
				score: expect.any(Number),
				matchedOn: expect.stringMatching(/shortName|nameNative|nameEnglish/)
			});
		});

		it('should handle empty parties array', () => {
			const organ = realOrgans.lfi;
			const parties: (typeof parlGovParties.lfi)[] = [];

			const result = findBestMatch(organ, parties);

			expect(result).toBeNull();
		});

		it('should handle organ with no shortName', () => {
			const organ = createTestOrgan({
				name: 'La République en Marche',
				shortName: null
			});
			const parties = [parlGovParties.lrem];

			const result = findBestMatch(organ, parties);

			expect(result).not.toBeNull();
			expect(result?.matchedOn).toBe('nameNative');
		});

		it('should handle party with missing fields', () => {
			const organ = createTestOrgan({
				name: 'Test Party',
				shortName: 'TP'
			});
			const party = createTestParlGovParty({
				shortName: '',
				nameEnglish: '',
				nameNative: 'Test Party'
			});

			const result = findBestMatch(organ, [party]);

			expect(result).not.toBeNull();
			expect(result?.matchedOn).toBe('nameNative');
		});

		it('should match real LFI organ to ParlGov LFI', () => {
			const result = findBestMatch(realOrgans.lfi, [parlGovParties.lfi]);

			expect(result).not.toBeNull();
			expect(result?.parlGovParty.shortName).toBe(parlGovParties.lfi.shortName);
		});

		it('should match real RN organ to ParlGov RN', () => {
			const result = findBestMatch(realOrgans.rn, [parlGovParties.rn]);

			expect(result).not.toBeNull();
			expect(result?.parlGovParty.shortName).toBe(parlGovParties.rn.shortName);
		});

		it('should match real LR organ to ParlGov LR', () => {
			const result = findBestMatch(realOrgans.lr, [parlGovParties.lr]);

			expect(result).not.toBeNull();
			expect(result?.parlGovParty.shortName).toBe(parlGovParties.lr.shortName);
		});
	});

	describe('matchAll', () => {
		it('should match all organs with their best parties', () => {
			const organs = [realOrgans.lfi, realOrgans.rn, realOrgans.lr];
			const parties = [parlGovParties.lfi, parlGovParties.rn, parlGovParties.lr];

			const result = matchAll(organs, parties);

			expect(result.matched).toHaveLength(3);
			expect(result.notMatched).toHaveLength(0);
		});

		it('should separate matched and not matched organs', () => {
			const organs = [
				realOrgans.lfi, // Devrait matcher
				createTestOrgan({ name: 'Unknown Party', shortName: 'UK' }) // Ne devrait pas matcher
			];
			const parties = [parlGovParties.lfi];

			const result = matchAll(organs, parties);

			expect(result.matched).toHaveLength(1);
			expect(result.notMatched).toHaveLength(1);
			expect(result.notMatched[0].shortName).toBe('UK');
		});

		it('should exclude NI groups from matched results', () => {
			const organs = [realOrgans.lfi, realOrgans.ni];
			const parties = [parlGovParties.lfi];

			const result = matchAll(organs, parties);

			expect(result.matched).toHaveLength(1);
			expect(result.notMatched).toHaveLength(1);
			expect(result.notMatched[0].id).toBe(realOrgans.ni.id);
		});

		it('should handle empty organs array', () => {
			const organs: (typeof realOrgans.lfi)[] = [];
			const parties = [parlGovParties.lfi];

			const result = matchAll(organs, parties);

			expect(result.matched).toHaveLength(0);
			expect(result.notMatched).toHaveLength(0);
		});

		it('should handle empty parties array', () => {
			const organs = [realOrgans.lfi, realOrgans.rn];
			const parties: (typeof parlGovParties.lfi)[] = [];

			const result = matchAll(organs, parties);

			expect(result.matched).toHaveLength(0);
			expect(result.notMatched).toHaveLength(2);
		});

		it('should pass through custom config', () => {
			const organs = [realOrgans.lfi];
			const parties = [parlGovParties.lfi];
			const config = { threshold: 0.5 }; // Threshold bas pour assurer le match

			const result = matchAll(organs, parties, config);

			// Avec threshold configuré, le matching devrait utiliser ce seuil
			expect(result.matched).toHaveLength(1);
		});

		it('should not duplicate matches for same organ', () => {
			const organ = realOrgans.lfi;
			const organs = [organ, organ, organ]; // Même organ 3 fois
			const parties = [parlGovParties.lfi];

			const result = matchAll(organs, parties);

			// Chaque organ est traité indépendamment
			expect(result.matched).toHaveLength(3);
		});
	});
});
