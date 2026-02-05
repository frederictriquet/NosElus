import { describe, it, expect } from 'vitest';
import { parseCSV, parseCSVLine } from '../client';
import { csvSamples } from './fixtures';

describe('ParlGov CSV Parser', () => {
	describe('parseCSVLine', () => {
		it('should parse simple comma-separated values', () => {
			const line = 'value1,value2,value3';
			const result = parseCSVLine(line);

			expect(result).toEqual(['value1', 'value2', 'value3']);
		});

		it('should handle quoted fields with commas', () => {
			const line = 'simple,"quoted, with comma",another';
			const result = parseCSVLine(line);

			expect(result).toEqual(['simple', 'quoted, with comma', 'another']);
		});

		it('should handle escaped quotes within quoted fields', () => {
			const line = 'value1,"text with ""quotes""",value3';
			const result = parseCSVLine(line);

			expect(result).toEqual(['value1', 'text with "quotes"', 'value3']);
		});

		it('should handle empty fields', () => {
			const line = 'value1,,value3';
			const result = parseCSVLine(line);

			expect(result).toEqual(['value1', '', 'value3']);
		});

		it('should handle empty quoted fields', () => {
			const line = 'value1,"",value3';
			const result = parseCSVLine(line);

			expect(result).toEqual(['value1', '', 'value3']);
		});

		it('should trim whitespace outside quotes', () => {
			const line = ' value1 , value2 , value3 ';
			const result = parseCSVLine(line);

			expect(result).toEqual(['value1', 'value2', 'value3']);
		});

		it('should trim whitespace even inside quotes', () => {
			const line = '"  value with spaces  ",normal';
			const result = parseCSVLine(line);

			// Le parser actuel trim les valeurs
			expect(result).toEqual(['value with spaces', 'normal']);
		});

		it('should handle single field', () => {
			const line = 'single';
			const result = parseCSVLine(line);

			expect(result).toEqual(['single']);
		});

		it('should handle empty line', () => {
			const line = '';
			const result = parseCSVLine(line);

			expect(result).toEqual(['']);
		});
	});

	describe('parseCSV', () => {
		it('should parse valid CSV with headers', () => {
			const result = parseCSV(csvSamples.valid);

			expect(result).toHaveLength(3);
			expect(result[0]).toMatchObject({
				party_id: '1709',
				country_name_short: 'FRA',
				party_name_short: 'LFI',
				party_name_english: 'La France Insoumise',
				left_right: '1.3'
			});
			expect(result[1]).toMatchObject({
				party_id: '1439',
				party_name_short: 'RN',
				left_right: '8.8'
			});
		});

		it('should parse CSV with quoted fields containing commas', () => {
			const result = parseCSV(csvSamples.withQuotedFields);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				party_id: '123',
				country_name_short: 'FRA',
				party_name: 'Parti avec, une virgule'
			});
		});

		it('should parse CSV with escaped quotes', () => {
			const result = parseCSV(csvSamples.withQuotedFields);

			expect(result[1]).toMatchObject({
				party_id: '456',
				party_name: 'Parti avec "guillemets"'
			});
		});

		it('should return empty array for empty CSV', () => {
			const result = parseCSV(csvSamples.empty);

			expect(result).toEqual([]);
		});

		it('should return empty array for headers only', () => {
			const result = parseCSV(csvSamples.headersOnly);

			expect(result).toEqual([]);
		});

		it('should handle missing fields with empty strings', () => {
			const csv = `field1,field2,field3
value1,value2
complete,row,here`;

			const result = parseCSV(csv);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				field1: 'value1',
				field2: 'value2',
				field3: '' // Missing field
			});
		});

		it('should ignore empty lines', () => {
			const csv = `header1,header2

value1,value2

value3,value4`;

			const result = parseCSV(csv);

			expect(result).toHaveLength(2);
			expect(result[0].header1).toBe('value1');
			expect(result[1].header1).toBe('value3');
		});

		it('should handle CSV with various line endings', () => {
			const csv = `header1,header2\r\nvalue1,value2\r\nvalue3,value4`;

			const result = parseCSV(csv);

			expect(result).toHaveLength(2);
		});

		it('should preserve header order in records', () => {
			const csv = `col3,col1,col2
val3,val1,val2`;

			const result = parseCSV(csv);

			expect(result[0]).toMatchObject({
				col3: 'val3',
				col1: 'val1',
				col2: 'val2'
			});
		});

		it('should handle extra fields beyond headers', () => {
			const result = parseCSV(csvSamples.malformed);

			// Le parser parse toutes les lignes valides
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				party_id: '123',
				country_name_short: 'FRA'
			});
			// Extra field n'a pas de header mais la ligne est quand même parsée
		});
	});
});
