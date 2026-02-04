import { describe, it, expect } from 'vitest';
import { determinePosition } from '../matcher';
import { createTestOrgan, realOrgans, parlGovParties } from './fixtures';
import type { MatchResult } from '../types';

/**
 * Helper pour créer un MatchResult de test
 */
function createMatchResult(
	organ: ReturnType<typeof createTestOrgan>,
	party: typeof parlGovParties.lfi
): MatchResult {
	return {
		organId: organ.id,
		organName: organ.name,
		organShortName: organ.shortName,
		parlGovParty: party,
		score: 0.8,
		matchedOn: 'nameNative'
	};
}

describe('ParlGov Matcher - Political Position', () => {
	describe('determinePosition', () => {
		it('should use ParlGov leftRight when available', () => {
			const organ = realOrgans.lfi;
			const match = createMatchResult(organ, parlGovParties.lfi);

			const position = determinePosition(organ, match);

			expect(position).toBe(1.3); // LFI left-wing
		});

		it('should return 999 for Non-inscrit groups', () => {
			const organ = realOrgans.ni;

			const position = determinePosition(organ, null);

			expect(position).toBe(999);
		});

		it('should return 5.0 as default for unmatched non-NI groups', () => {
			const organ = createTestOrgan({
				name: 'Unknown Party',
				shortName: 'UK'
			});

			const position = determinePosition(organ, null);

			expect(position).toBe(5.0); // Centre
		});

		it('should fallback to family position when leftRight is null', () => {
			const organ = createTestOrgan({
				name: 'Test Socialist Party',
				shortName: 'TSP'
			});
			const party = { ...parlGovParties.ps, leftRight: null };
			const match = createMatchResult(organ, party);

			const position = determinePosition(organ, match);

			// familyShort = 'soc' → devrait mapper à une position
			expect(typeof position).toBe('number');
			expect(position).toBeGreaterThanOrEqual(0);
			expect(position).toBeLessThanOrEqual(10);
		});

		it('should prioritize leftRight over family', () => {
			const organ = realOrgans.lfi;
			const match = createMatchResult(organ, {
				...parlGovParties.lfi,
				leftRight: 2.0,
				familyShort: 'soc' // Famille différente
			});

			const position = determinePosition(organ, match);

			expect(position).toBe(2.0); // leftRight prioritaire
		});

		it('should handle match without family when leftRight is null', () => {
			const organ = createTestOrgan({
				name: 'Test Party',
				shortName: 'TP'
			});
			const party = {
				...parlGovParties.lfi,
				leftRight: null,
				familyShort: null
			};
			const match = createMatchResult(organ, party);

			const position = determinePosition(organ, match);

			expect(position).toBe(5.0); // Fallback to center
		});

		it('should return 999 for NI groups even if they have a match', () => {
			const organ = realOrgans.ni;
			const match = createMatchResult(organ, parlGovParties.lfi);

			const position = determinePosition(organ, match);

			// NI doit toujours être à la fin du spectre, même avec un match ParlGov
			// C'est le comportement correct : NI n'est pas un parti politique
			expect(position).toBe(999);
		});

		it('should handle zero leftRight value', () => {
			const organ = createTestOrgan({
				name: 'Far Left Party',
				shortName: 'FLP'
			});
			const party = { ...parlGovParties.lfi, leftRight: 0 };
			const match = createMatchResult(organ, party);

			const position = determinePosition(organ, match);

			expect(position).toBe(0); // 0 is valid (far left)
		});

		it('should handle max leftRight value (10)', () => {
			const organ = createTestOrgan({
				name: 'Far Right Party',
				shortName: 'FRP'
			});
			const party = { ...parlGovParties.rn, leftRight: 10 };
			const match = createMatchResult(organ, party);

			const position = determinePosition(organ, match);

			expect(position).toBe(10);
		});

		it('should handle fractional leftRight values', () => {
			const organ = realOrgans.lfi;
			const match = createMatchResult(organ, {
				...parlGovParties.lfi,
				leftRight: 3.7
			});

			const position = determinePosition(organ, match);

			expect(position).toBe(3.7);
		});

		it('should use family position for communist party', () => {
			const organ = createTestOrgan({
				name: 'Communist Party',
				shortName: 'COM'
			});
			const party = {
				...parlGovParties.lfi,
				leftRight: null,
				familyShort: 'com'
			};
			const match = createMatchResult(organ, party);

			const position = determinePosition(organ, match);

			// Com family devrait avoir une position de gauche
			expect(position).toBeLessThan(5.0);
		});

		it('should use family position for conservative party', () => {
			const organ = realOrgans.lr;
			const party = {
				...parlGovParties.lr,
				leftRight: null,
				familyShort: 'con'
			};
			const match = createMatchResult(organ, party);

			const position = determinePosition(organ, match);

			// Conservative family devrait avoir une position de droite
			expect(position).toBeGreaterThan(5.0);
		});

		it('should handle unknown family gracefully', () => {
			const organ = createTestOrgan({
				name: 'Unknown Family Party',
				shortName: 'UFP'
			});
			const party = {
				...parlGovParties.lfi,
				leftRight: null,
				familyShort: 'unknown_family'
			};
			const match = createMatchResult(organ, party);

			const position = determinePosition(organ, match);

			expect(position).toBe(5.0); // Fallback to center
		});

		it('should correctly order parties by position', () => {
			const organs = [realOrgans.lfi, realOrgans.lr, realOrgans.rn];
			const matches = [
				createMatchResult(realOrgans.lfi, parlGovParties.lfi),
				createMatchResult(realOrgans.lr, parlGovParties.lr),
				createMatchResult(realOrgans.rn, parlGovParties.rn)
			];

			const positions = organs.map((organ, i) => determinePosition(organ, matches[i]));

			// LFI (1.3) < LR (7.4) < RN (8.8)
			expect(positions[0]).toBeLessThan(positions[1]);
			expect(positions[1]).toBeLessThan(positions[2]);
		});

		it('should place NI at the end (999)', () => {
			const organs = [realOrgans.lfi, realOrgans.ni, realOrgans.rn];
			const positions = organs.map((organ) => determinePosition(organ, null));

			const maxRegularPosition = Math.max(positions[0], positions[2]);
			const niPosition = positions[1];

			expect(niPosition).toBe(999);
			expect(niPosition).toBeGreaterThan(maxRegularPosition);
		});

		it('should handle real LFI position', () => {
			const match = createMatchResult(realOrgans.lfi, parlGovParties.lfi);
			const position = determinePosition(realOrgans.lfi, match);

			expect(position).toBe(1.3);
		});

		it('should handle real RN position', () => {
			const match = createMatchResult(realOrgans.rn, parlGovParties.rn);
			const position = determinePosition(realOrgans.rn, match);

			expect(position).toBe(8.8);
		});

		it('should handle real LR position', () => {
			const match = createMatchResult(realOrgans.lr, parlGovParties.lr);
			const position = determinePosition(realOrgans.lr, match);

			expect(position).toBe(7.4);
		});

		it('should handle real PS position', () => {
			const organ = createTestOrgan({
				name: 'Parti socialiste',
				shortName: 'PS'
			});
			const match = createMatchResult(organ, parlGovParties.ps);
			const position = determinePosition(organ, match);

			expect(position).toBe(3.8);
		});
	});
});
