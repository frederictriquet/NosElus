/**
 * Tests unitaires pour scrutin-simplifier.ts
 *
 * Seule parseSimplifiedTitle() est testée ici (fonction pure, sans dépendance DB/LLM).
 * Les fonctions nécessitant Ollama ou la DB sont couvertes par des tests d'intégration séparés.
 */

import { describe, it, expect } from 'vitest';
import { parseSimplifiedTitle } from './scrutin-simplifier';

// ============================================================
// parseSimplifiedTitle — happy paths
// ============================================================

describe('parseSimplifiedTitle — happy paths', () => {
	it('should parse a clean JSON response with clé "titre"', () => {
		const raw = '{"titre": "Augmenter le SMIC à 1500€ net"}';
		expect(parseSimplifiedTitle(raw)).toBe('Augmenter le SMIC à 1500€ net');
	});

	it('should accept clé "title" (alias anglais)', () => {
		const raw = '{"title": "Réforme des retraites"}';
		expect(parseSimplifiedTitle(raw)).toBe('Réforme des retraites');
	});

	it('should accept clé "titre_simple"', () => {
		const raw = '{"titre_simple": "Budget de la sécurité sociale"}';
		expect(parseSimplifiedTitle(raw)).toBe('Budget de la sécurité sociale');
	});

	it('should trim surrounding whitespace from the title', () => {
		const raw = '{"titre": "  Motion de censure de la NUPES  "}';
		expect(parseSimplifiedTitle(raw)).toBe('Motion de censure de la NUPES');
	});

	it('should extract JSON even when surrounded by LLM chatter', () => {
		const raw = `Voici le titre simplifié :\n{"titre": "Financement de la sécurité sociale 2024"}\nJ'espère que cela convient.`;
		expect(parseSimplifiedTitle(raw)).toBe('Financement de la sécurité sociale 2024');
	});

	it('should handle extra fields in the JSON object', () => {
		const raw = '{"titre": "Réforme fiscale", "confiance": 0.9, "note": "ok"}';
		expect(parseSimplifiedTitle(raw)).toBe('Réforme fiscale');
	});

	it('should strip a trailing comma before closing brace', () => {
		const raw = '{"titre": "Augmenter le SMIC",}';
		expect(parseSimplifiedTitle(raw)).toBe('Augmenter le SMIC');
	});
});

// ============================================================
// parseSimplifiedTitle — truncature à 300 caractères
// ============================================================

describe('parseSimplifiedTitle — troncature', () => {
	it('should return a title of exactly 300 chars when input exceeds 300', () => {
		const longTitle = 'A'.repeat(350);
		const raw = `{"titre": "${longTitle}"}`;
		const result = parseSimplifiedTitle(raw);
		expect(result).toHaveLength(300);
	});

	it('should return a title unchanged when it is exactly 300 chars', () => {
		const title = 'A'.repeat(300);
		const raw = `{"titre": "${title}"}`;
		expect(parseSimplifiedTitle(raw)).toHaveLength(300);
	});

	it('should return a title unchanged when it is shorter than 300 chars', () => {
		const title = 'Augmenter le SMIC';
		const raw = `{"titre": "${title}"}`;
		expect(parseSimplifiedTitle(raw)).toBe(title);
	});
});

// ============================================================
// parseSimplifiedTitle — cas d'erreur → retourne null
// ============================================================

describe('parseSimplifiedTitle — cas invalides', () => {
	it('should return null when there is no JSON in the response', () => {
		expect(parseSimplifiedTitle('Désolé, je ne comprends pas.')).toBeNull();
	});

	it('should return null when the JSON has no recognizable title key', () => {
		const raw = '{"summary": "Augmenter le SMIC"}';
		expect(parseSimplifiedTitle(raw)).toBeNull();
	});

	it('should return null when the titre value is an empty string', () => {
		const raw = '{"titre": ""}';
		expect(parseSimplifiedTitle(raw)).toBeNull();
	});

	it('should return null when the titre value is only whitespace', () => {
		const raw = '{"titre": "   "}';
		expect(parseSimplifiedTitle(raw)).toBeNull();
	});

	it('should return null when the JSON is malformed and unrepairable', () => {
		const raw = '{"titre": Augmenter le SMIC}'; // valeur non quoted
		expect(parseSimplifiedTitle(raw)).toBeNull();
	});

	it('should return null on empty string input', () => {
		expect(parseSimplifiedTitle('')).toBeNull();
	});

	it('should return null when titre is a number (type incorrect)', () => {
		const raw = '{"titre": 42}';
		expect(parseSimplifiedTitle(raw)).toBeNull();
	});

	it('should return null when titre is null in JSON', () => {
		const raw = '{"titre": null}';
		expect(parseSimplifiedTitle(raw)).toBeNull();
	});
});

// ============================================================
// parseSimplifiedTitle — priorité des clés
// ============================================================

describe('parseSimplifiedTitle — priorité des clés', () => {
	it('should prefer "titre" over "title" when both are present', () => {
		const raw = '{"titre": "Titre FR", "title": "Title EN"}';
		// La logique utilise data.titre || data.title, donc "titre" gagne si non vide
		expect(parseSimplifiedTitle(raw)).toBe('Titre FR');
	});

	it('should fall back to "title" when "titre" is absent', () => {
		const raw = '{"title": "Réforme des retraites"}';
		expect(parseSimplifiedTitle(raw)).toBe('Réforme des retraites');
	});

	it('should fall back to "titre_simple" when "titre" and "title" are absent', () => {
		const raw = '{"titre_simple": "Budget social 2024"}';
		expect(parseSimplifiedTitle(raw)).toBe('Budget social 2024');
	});
});
