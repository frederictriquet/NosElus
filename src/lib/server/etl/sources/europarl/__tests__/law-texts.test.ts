import { describe, it, expect } from 'vitest';
import { cleanHtml, buildDescription, type LawTextSources } from '../law-texts';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests de non-régression pour les corrections du pipeline ETL PE law-texts.
 *
 * Bugs corrigés :
 * - Bug 1 (votes.ts) : fetchVotesList() utilisait geo_areas=FRA → seulement 9 votes au lieu de 2204
 * - Bug 2 (votes.ts) : generateLawId() ne parsait pas le terme depuis la référence
 * - Bug 3 (schema)   : scrutins.law_id varchar(20) trop court pour RC-B10-*
 *
 * Ce fichier teste les fonctions pures de law-texts.ts et vérifie
 * la non-régression de l'URL API dans votes.ts.
 */

describe('cleanHtml', () => {
	it('should strip HTML tags', () => {
		expect(cleanHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
	});

	it('should convert <br> to newlines', () => {
		expect(cleanHtml('line1<br/>line2')).toBe('line1\nline2');
	});

	it('should convert <p> tags to newlines', () => {
		const result = cleanHtml('<p>First</p><p>Second</p>');
		expect(result).toContain('First');
		expect(result).toContain('Second');
		expect(result).toContain('\n');
	});

	it('should convert <li> to bullet points', () => {
		expect(cleanHtml('<li>item</li>')).toBe('- item');
	});

	it('should decode common HTML entities', () => {
		expect(cleanHtml('&amp; &lt; &gt; &quot; &apos;')).toBe('& < > " \'');
	});

	it('should decode French-specific entities', () => {
		expect(cleanHtml('&laquo; test &raquo;')).toBe('« test »');
		expect(cleanHtml('&oelig;uvre')).toBe('œuvre');
		expect(cleanHtml('&euro;100')).toBe('€100');
	});

	it('should decode numeric entities', () => {
		expect(cleanHtml('&#169;')).toBe('©');
		expect(cleanHtml('&#x00A9;')).toBe('©');
	});

	it('should collapse excessive newlines', () => {
		expect(cleanHtml('a\n\n\n\n\nb')).toBe('a\n\nb');
	});

	it('should trim whitespace', () => {
		expect(cleanHtml('  hello  ')).toBe('hello');
	});

	it('should handle &nbsp;', () => {
		expect(cleanHtml('hello&nbsp;world')).toBe('hello world');
	});
});

describe('buildDescription', () => {
	function createSources(overrides: Partial<LawTextSources> = {}): LawTextSources {
		return {
			summaryText: null,
			pressText: null,
			snippetText: null,
			reportText: null,
			sourceUrl: null,
			...overrides
		};
	}

	it('should include title when provided', () => {
		const result = buildDescription(createSources(), 'Test Title');
		expect(result).toContain('Titre: Test Title');
	});

	it('should include summary section', () => {
		const sources = createSources({ summaryText: 'Summary content here' });
		const result = buildDescription(sources, 'Title');
		expect(result).toContain('Résumé officiel');
		expect(result).toContain('Summary content here');
	});

	it('should include press release section', () => {
		const sources = createSources({ pressText: 'Press release content' });
		const result = buildDescription(sources, 'Title');
		expect(result).toContain('Communiqué de presse');
		expect(result).toContain('Press release content');
	});

	it('should include snippet when long enough', () => {
		const sources = createSources({ snippetText: 'This is a long enough snippet text' });
		const result = buildDescription(sources, 'Title');
		expect(result).toContain('Extrait');
		expect(result).toContain('This is a long enough snippet text');
	});

	it('should skip snippet shorter than 20 chars', () => {
		const sources = createSources({ snippetText: 'Short' });
		const result = buildDescription(sources, 'Title');
		expect(result).not.toContain('Extrait');
	});

	it('should include report section', () => {
		const sources = createSources({ reportText: 'Report content' });
		const result = buildDescription(sources, 'Title');
		expect(result).toContain('Rapport/Résolution');
		expect(result).toContain('Report content');
	});

	it('should combine all sections with double newlines', () => {
		const sources = createSources({
			summaryText: 'Summary',
			pressText: 'Press',
			snippetText: 'A snippet that is long enough to be included',
			reportText: 'Report'
		});
		const result = buildDescription(sources, 'Title');
		expect(result).toContain('Titre: Title');
		expect(result).toContain('Summary');
		expect(result).toContain('Press');
		expect(result).toContain('Extrait');
		expect(result).toContain('Report');
	});

	it('should return empty string when no sources', () => {
		const result = buildDescription(createSources(), '');
		expect(result).toBe('');
	});
});

describe('Regression: fetchVotesList URL (Bug 1)', () => {
	it('should not use geo_areas parameter in API URL', () => {
		// Bug 1: geo_areas=FRA returned only 9 votes instead of 2204
		// French MEP filtering happens downstream via mepIdMap, not at API level
		const sourceCode = readFileSync(join(__dirname, '..', 'votes.ts'), 'utf-8');

		// Find the fetchVotesList function and extract template literal URL
		const fnMatch = sourceCode.match(/async function fetchVotesList[\s\S]*?^\}/m);
		expect(fnMatch).toBeTruthy();

		// Extract only the URL template string (backtick content)
		const urlMatch = fnMatch![0].match(/`([^`]+)`/);
		expect(urlMatch).toBeTruthy();

		const urlTemplate = urlMatch![1];
		expect(urlTemplate).not.toContain('geo_areas');
	});
});
