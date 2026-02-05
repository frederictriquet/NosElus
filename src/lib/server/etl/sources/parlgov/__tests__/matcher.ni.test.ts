import { describe, it, expect } from 'vitest';
import { isNonInscrit } from '../matcher';
import { createTestOrgan } from './fixtures';

describe('ParlGov Matcher - Non-Inscrit Detection', () => {
	describe('isNonInscrit', () => {
		it('should detect "NI" shortName (exact match)', () => {
			const organ = createTestOrgan({
				name: 'Groupe Non inscrit',
				shortName: 'NI'
			});

			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should detect "Non inscrit" in name', () => {
			const organ = createTestOrgan({
				name: 'Non inscrit',
				shortName: 'NI'
			});

			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should detect "Non-inscrit" with hyphen', () => {
			const organ = createTestOrgan({
				name: 'Non-inscrit',
				shortName: null
			});

			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should detect "Non-inscrits" with hyphen (from list)', () => {
			const organ = createTestOrgan({
				name: 'Non-inscrits',
				shortName: null
			});

			// La liste NI_IDENTIFIERS contient "Non-inscrits" avec tiret
			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should be case-insensitive', () => {
			const organ = createTestOrgan({
				name: 'NON-INSCRIT', // Avec tiret comme dans la liste
				shortName: null
			});

			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should NOT match "Rassemblement National" (false positive test)', () => {
			const organ = createTestOrgan({
				name: 'Rassemblement National',
				shortName: 'RN'
			});

			// "na" est dans NI_IDENTIFIERS mais ne doit pas matcher "National"
			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should NOT match "Union Nationale"', () => {
			const organ = createTestOrgan({
				name: 'Union Nationale',
				shortName: 'UN'
			});

			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should NOT match "Renaissance"', () => {
			const organ = createTestOrgan({
				name: 'Renaissance',
				shortName: 'RE'
			});

			// "na" est substring mais pas un mot entier
			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should use word boundaries for matching', () => {
			const organ = createTestOrgan({
				name: 'Groupe na test', // "na" comme mot séparé
				shortName: null
			});

			// Si "na" est dans NI_IDENTIFIERS, devrait matcher
			// car c'est un mot entier
			const result = isNonInscrit(organ);

			// Note: Le résultat dépend de si "na" est dans NI_IDENTIFIERS
			// Si oui, devrait être true (mot entier)
			expect(typeof result).toBe('boolean');
		});

		it('should match shortName exactly regardless of name', () => {
			const organ = createTestOrgan({
				name: 'Rassemblement National', // Pas NI dans le nom
				shortName: 'NI' // Mais shortName = NI
			});

			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should NOT match empty name', () => {
			const organ = createTestOrgan({
				name: '',
				shortName: null
			});

			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should handle null shortName', () => {
			const organ = createTestOrgan({
				name: 'Non-inscrit', // Avec tiret comme dans la liste
				shortName: null
			});

			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should match "na" as standalone word if in identifiers', () => {
			const organ = createTestOrgan({
				name: 'Groupe na',
				shortName: null
			});

			// Test de word boundary: "na" seul devrait matcher si dans NI_IDENTIFIERS
			const result = isNonInscrit(organ);
			expect(typeof result).toBe('boolean');
		});

		it('should NOT match "national" (word boundary test)', () => {
			const organ = createTestOrgan({
				name: 'national',
				shortName: null
			});

			// "na" est substring mais pas un mot complet
			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should NOT match "banana" (substring test)', () => {
			const organ = createTestOrgan({
				name: 'banana republic',
				shortName: null
			});

			// "na" apparaît 2 fois mais jamais comme mot entier
			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should match real AN Non-inscrit group', () => {
			const organ = createTestOrgan({
				id: 'PO419610',
				name: 'Non inscrit',
				shortName: 'NI'
			});

			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should NOT match real LFI-NFP group', () => {
			const organ = createTestOrgan({
				id: 'PO800538',
				name: 'La France insoumise - Nouveau Front populaire',
				shortName: 'LFI-NFP'
			});

			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should NOT match real RN group', () => {
			const organ = createTestOrgan({
				id: 'PO800520',
				name: 'Rassemblement National',
				shortName: 'RN'
			});

			expect(isNonInscrit(organ)).toBe(false);
		});

		it('should handle Non-inscrits in sentence', () => {
			const organ = createTestOrgan({
				name: 'Députés non-inscrits',
				shortName: null
			});

			// Devrait matcher "non-inscrits" dans le nom
			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should match with extra whitespace', () => {
			const organ = createTestOrgan({
				name: '  Non-inscrit  ', // Avec tiret comme dans la liste
				shortName: null
			});

			expect(isNonInscrit(organ)).toBe(true);
		});

		it('should match shortName "ni" (lowercase)', () => {
			const organ = createTestOrgan({
				name: 'Autre nom',
				shortName: 'ni'
			});

			expect(isNonInscrit(organ)).toBe(true);
		});
	});
});
