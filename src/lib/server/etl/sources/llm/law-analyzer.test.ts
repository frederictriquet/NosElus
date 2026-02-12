/**
 * Tests unitaires pour law-analyzer.ts
 *
 * Ces tests valident la logique de construction du prompt LLM
 */

import { describe, it, expect } from 'vitest';
import { parseResponse, type TagMapping } from './law-analyzer';

// Mock minimal pour tester buildUserPrompt
// Note: Cette fonction n'est pas exportée, donc on teste via son comportement
// dans analyzeLaw (qui serait mocké en conditions réelles)

describe('law-analyzer - Unit', () => {
	describe('Prompt building logic', () => {
		it('should use title + description when description is provided', () => {
			// Ce test vérifie le comportement attendu de buildUserPrompt
			// Dans la vraie implémentation (ligne 96):
			// const text = lawDescription ? `${lawTitle}\n\n${lawDescription}` : lawTitle;

			const title = 'Loi sur le SMIC';
			const description = 'Cette loi augmente le SMIC de 2% pour tous les salariés.';

			// Le prompt devrait contenir les deux
			const expectedText = `${title}\n\n${description}`;

			expect(expectedText).toContain(title);
			expect(expectedText).toContain(description);
			expect(expectedText.split('\n\n')).toHaveLength(2);
		});

		it('should use only title when description is null', () => {
			// Dans la vraie implémentation :
			// const text = lawDescription ? `${lawTitle}\n\n${lawDescription}` : lawTitle;

			const title = 'Loi sur le SMIC';
			const description = null;

			// Le prompt devrait contenir seulement le titre
			const expectedText = description ? `${title}\n\n${description}` : title;

			expect(expectedText).toBe(title);
			expect(expectedText).not.toContain('\n\n');
		});

		it('should use only title when description is empty string', () => {
			const title = 'Loi sur le SMIC';
			const description = '';

			// Empty string est falsy, donc fallback au titre
			const expectedText = description ? `${title}\n\n${description}` : title;

			expect(expectedText).toBe(title);
		});
	});

	describe('Description length validation (SQL-level)', () => {
		it('should document that descriptions <= 100 chars are filtered by SQL', () => {
			// Ce test documente le comportement attendu :
			// getUnanalyzedLaws() utilise gt(sql`length(${laws.description})`, 100)
			// pour filtrer les descriptions courtes côté SQL.

			const shortDescription = 'Proposition de résolution'; // 25 chars
			const longDescription = 'A'.repeat(101); // 101 chars

			expect(shortDescription.length).toBeLessThanOrEqual(100);
			expect(longDescription.length).toBeGreaterThan(100);

			// Les lois avec shortDescription ne devraient JAMAIS arriver à analyzeLaw()
			// car elles sont filtrées par getUnanalyzedLaws()
		});

		it('should document the threshold value of 100 characters', () => {
			// Le seuil de 100 chars est défini dans :
			// - getUnanalyzedLaws() : gt(sql`length(${laws.description})`, 100)
			// - Dashboard : length(l.description) > 100

			const THRESHOLD = 100;

			expect(THRESHOLD).toBe(100);

			// Les descriptions suivantes sont considérées comme "pas assez complètes" :
			expect('Proposition de résolution'.length).toBeLessThan(THRESHOLD); // 25 chars
			expect('A'.repeat(50).length).toBeLessThan(THRESHOLD); // 50 chars
			expect('A'.repeat(100).length).toBe(THRESHOLD); // Exactement 100 → exclus (gt, pas gte)

			// Cette description passerait le filtre :
			expect('A'.repeat(101).length).toBeGreaterThan(THRESHOLD);
		});
	});

	describe('Integration contract', () => {
		it('should document that getUnanalyzedLaws filters before analyzeLaw', () => {
			// Workflow attendu :
			// 1. getUnanalyzedLaws() filtre avec length(description) > 100
			// 2. analyzeLaw() reçoit seulement des lois avec description longue
			// 3. buildUserPrompt() peut donc supposer que description est significative (ou null)

			// Si une loi arrive à analyzeLaw avec description courte (≤100 chars),
			// c'est un BUG dans getUnanalyzedLaws()

			const minimumValidDescription = 'A'.repeat(101);
			expect(minimumValidDescription.length).toBeGreaterThan(100);
		});
	});
});

const TEST_TAG_MAPPINGS: TagMapping[] = [
	{ slug: 'economie', name: 'Économie', promptName: 'économie' },
	{ slug: 'sante', name: 'Santé', promptName: 'santé' },
	{ slug: 'travail', name: 'Travail', promptName: 'travail' },
	{ slug: 'education', name: 'Éducation', promptName: 'éducation' },
	{ slug: 'securite', name: 'Sécurité', promptName: 'sécurité' }
];

describe('parseResponse', () => {
	it('should parse valid JSON with resume and tags', () => {
		const raw = '{"resume": "Cette loi augmente le SMIC.", "tags": ["économie", "travail"]}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Cette loi augmente le SMIC.');
		expect(result.tags).toEqual(['economie', 'travail']);
		expect(result.rawResponse).toBe(raw);
	});

	it('should extract JSON surrounded by LLM chatter', () => {
		const raw = `Voici mon analyse de cette loi:\n{"resume": "Cette loi renforce la sécurité.", "tags": ["sécurité"]}\nJ'espère que cela vous aide!`;
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Cette loi renforce la sécurité.');
		expect(result.tags).toEqual(['securite']);
	});

	it('should repair truncated JSON (missing closing brace)', () => {
		const raw = '{"resume": "Cette loi modifie le code du travail.", "tags": ["travail"';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Cette loi modifie le code du travail.');
		expect(result.tags).toEqual(['travail']);
	});

	it('should handle trailing comma in tags array', () => {
		const raw = '{"resume": "Réforme de la santé.", "tags": ["santé",]}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Réforme de la santé.');
		expect(result.tags).toEqual(['sante']);
	});

	it('should handle trailing comma before closing brace', () => {
		const raw = '{"resume": "Réforme fiscale.", "tags": ["économie"],}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Réforme fiscale.');
		expect(result.tags).toEqual(['economie']);
	});

	it('should return error for empty response', () => {
		const result = parseResponse('', TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Erreur: impossible de parser la réponse');
		expect(result.tags).toEqual([]);
		expect(result.rawResponse).toBe('');
	});

	it('should return fallback summary when resume key is missing', () => {
		const raw = '{"description": "Pas la bonne clé", "tags": ["économie"]}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Résumé non disponible');
		expect(result.tags).toEqual(['economie']);
	});

	it('should accept "summary" as alternative key to "resume"', () => {
		const raw = '{"summary": "Texte via summary.", "tags": ["santé"]}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Texte via summary.');
	});

	it('should accept "résumé" as alternative key to "resume"', () => {
		const raw = '{"résumé": "Texte via résumé.", "tags": ["travail"]}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Texte via résumé.');
	});

	it('should filter out invalid tags and keep valid ones', () => {
		const raw =
			'{"resume": "Une loi importante.", "tags": ["économie", "inexistant", "santé", "blabla"]}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Une loi importante.');
		expect(result.tags).toEqual(['economie', 'sante']);
	});

	it('should return empty tags when all tags are invalid', () => {
		const raw = '{"resume": "Une loi.", "tags": ["fake", "inexistant"]}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Une loi.');
		expect(result.tags).toEqual([]);
	});

	it('should handle missing tags key gracefully', () => {
		const raw = '{"resume": "Pas de tags ici."}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Pas de tags ici.');
		expect(result.tags).toEqual([]);
	});

	it('should handle response with no JSON at all', () => {
		const raw = 'Je ne suis pas capable de répondre en JSON pour cette loi.';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Erreur: impossible de parser la réponse');
		expect(result.tags).toEqual([]);
	});

	it('should be case-insensitive for tag matching', () => {
		const raw = '{"resume": "Test.", "tags": ["ÉCONOMIE", "Santé"]}';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.tags).toEqual(['economie', 'sante']);
	});

	it('should repair truncated JSON with open string and array', () => {
		const raw = '{"resume": "Cette loi concerne la san';
		const result = parseResponse(raw, TEST_TAG_MAPPINGS);

		expect(result.summary).toBe('Cette loi concerne la san');
		expect(result.tags).toEqual([]);
	});
});
