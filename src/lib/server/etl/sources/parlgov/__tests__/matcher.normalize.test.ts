import { describe, it, expect } from 'vitest';
import { normalizeForMatching } from '../matcher';

describe('ParlGov Matcher - Text Normalization', () => {
	describe('normalizeForMatching', () => {
		it('should convert to lowercase', () => {
			const result = normalizeForMatching('UPPERCASE Text');

			expect(result).toBe('uppercase text');
		});

		it('should remove French accents', () => {
			const text = 'République Française Écologie';
			const result = normalizeForMatching(text);

			expect(result).toBe('republique francaise ecologie');
		});

		it('should remove cedillas', () => {
			const result = normalizeForMatching('Français');

			expect(result).toBe('francais');
		});

		it('should handle various diacritics', () => {
			const text = 'àâäéèêëïîôùûç';
			const result = normalizeForMatching(text);

			// ç→c, accents supprimés, lettres seules < 2 chars supprimées
			expect(result).toBe('aaaeeeeiiouuc');
		});

		it('should remove punctuation', () => {
			const text = "L'Europe, c'est nous!";
			const result = normalizeForMatching(text);

			// Apostrophes → espaces, ponctuation supprimée
			expect(result).not.toContain(',');
			expect(result).not.toContain('!');
			expect(result).not.toContain("'");
		});

		it('should normalize multiple spaces to single space', () => {
			const text = 'multiple    spaces   here';
			const result = normalizeForMatching(text);

			// "here" n'est pas un stop word français, il reste
			expect(result).toBe('multiple spaces here');
		});

		it('should trim leading and trailing whitespace', () => {
			const text = '   spaces around   ';
			const result = normalizeForMatching(text);

			expect(result).toBe('spaces around');
		});

		it('should remove French stop words', () => {
			const text = 'le groupe de la république';
			const result = normalizeForMatching(text);

			// "le", "de", "la", "groupe" sont des stop words
			expect(result).toBe('republique');
		});

		it('should remove "parti", "mouvement", "front" stop words', () => {
			const text = 'Parti Socialiste Français';
			const result = normalizeForMatching(text);

			// "parti" est stop word
			expect(result).toBe('socialiste francais');
		});

		it('should remove "union", "rassemblement", "alliance" stop words', () => {
			const text = 'Union pour le Rassemblement';
			const result = normalizeForMatching(text);

			expect(result).toBe(''); // Tous sont des stop words
		});

		it('should keep words longer than 1 character', () => {
			const text = 'a ab abc';
			const result = normalizeForMatching(text);

			// "a" (1 char) supprimé, "ab" et "abc" conservés
			expect(result).toBe('ab abc');
		});

		it('should handle empty string', () => {
			const result = normalizeForMatching('');

			expect(result).toBe('');
		});

		it('should handle string with only stop words', () => {
			const text = 'le la les un une des';
			const result = normalizeForMatching(text);

			expect(result).toBe('');
		});

		it('should handle apostrophes correctly', () => {
			const text = "L'Assemblée Nationale";
			const result = normalizeForMatching(text);

			// Apostrophe → espace, stop words supprimés
			expect(result).toBe('assemblee nationale');
		});

		it('should handle mixed case with accents and punctuation', () => {
			const text = "La République Française, C'est NOUS!";
			const result = normalizeForMatching(text);

			// "est" n'est pas dans les stop words
			expect(result).toBe('republique francaise est nous');
		});

		it('should be idempotent for already normalized text', () => {
			const normalized = 'simple text';
			const result = normalizeForMatching(normalized);

			expect(result).toBe('simple text');
		});

		it('should handle numbers', () => {
			const text = 'Groupe 2024';
			const result = normalizeForMatching(text);

			expect(result).toBe('2024'); // "groupe" est stop word
		});

		it('should handle real party name: La France Insoumise', () => {
			const result = normalizeForMatching('La France Insoumise');

			expect(result).toBe('france insoumise');
		});

		it('should handle real party name: Rassemblement National', () => {
			const result = normalizeForMatching('Rassemblement National');

			expect(result).toBe('national'); // "rassemblement" est stop word
		});

		it('should handle real party name: Les Républicains', () => {
			const result = normalizeForMatching('Les Républicains');

			expect(result).toBe('republicains');
		});

		it('should handle real party name: Europe Écologie Les Verts', () => {
			const result = normalizeForMatching('Europe Écologie Les Verts');

			expect(result).toBe('europe ecologie verts');
		});
	});
});
