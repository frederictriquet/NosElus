/**
 * Client ParlGov - Téléchargement et parsing du CSV des partis
 *
 * @see https://www.parlgov.org/data/parlgov-development_csv-utf-8/view_party.csv
 */

import type { ParlGovParty, ParlGovPartyRaw, ParlGovClientConfig } from './types';

/** URL par défaut du CSV ParlGov */
const DEFAULT_CSV_URL = 'https://www.parlgov.org/data/parlgov-development_csv-utf-8/view_party.csv';

/** Timeout par défaut en ms */
const DEFAULT_TIMEOUT = 30000;

/** Codes pays par défaut (France uniquement) */
const DEFAULT_COUNTRY_CODES = ['FRA'];

/**
 * Parse une ligne CSV en tenant compte des guillemets
 * Exported for testing
 */
export function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++; // Skip next quote
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}
	result.push(current.trim());

	return result;
}

/**
 * Parse un CSV complet en objets avec colonnes comme clés
 * Exported for testing
 */
export function parseCSV(csvText: string): Record<string, string>[] {
	const lines = csvText.split('\n').filter((line) => line.trim());
	if (lines.length === 0) return [];

	const headers = parseCSVLine(lines[0]);
	const records: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i]);
		const record: Record<string, string> = {};

		for (let j = 0; j < headers.length; j++) {
			record[headers[j]] = values[j] || '';
		}

		records.push(record);
	}

	return records;
}

/**
 * Erreur lors de la récupération des données ParlGov
 */
export class ParlGovFetchError extends Error {
	constructor(
		message: string,
		public url: string,
		public cause?: Error
	) {
		super(`ParlGov fetch failed: ${message}`);
		this.name = 'ParlGovFetchError';
	}
}

/**
 * Parse une ligne brute CSV en ParlGovParty normalisé
 */
function parseParty(raw: ParlGovPartyRaw): ParlGovParty {
	return {
		countryCode: raw.country_name_short?.trim() || '',
		shortName: raw.party_name_short?.trim() || '',
		nameEnglish: raw.party_name_english?.trim() || '',
		nameNative: raw.party_name?.trim() || '',
		familyShort: raw.family_name_short?.trim().toLowerCase() || '',
		leftRight: raw.left_right ? parseFloat(raw.left_right) : null
	};
}

/**
 * Télécharge et parse le CSV ParlGov complet
 *
 * @param config - Configuration optionnelle
 * @returns Liste de tous les partis ParlGov
 * @throws {ParlGovFetchError} Si le téléchargement ou le parsing échoue
 */
export async function fetchAllParties(config?: ParlGovClientConfig): Promise<ParlGovParty[]> {
	const url = config?.csvUrl || DEFAULT_CSV_URL;
	const timeout = config?.timeout || DEFAULT_TIMEOUT;

	console.log(`[ParlGov] Fetching CSV from ${url}...`);

	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(timeout),
			headers: {
				'User-Agent': 'NosElus-ETL/1.0 (https://noselus.fr)'
			}
		});

		if (!response.ok) {
			throw new ParlGovFetchError(`HTTP ${response.status}: ${response.statusText}`, url);
		}

		const csvText = await response.text();
		console.log(`[ParlGov] Downloaded ${(csvText.length / 1024).toFixed(1)} KB`);

		// Parse CSV avec notre parser natif
		const records = parseCSV(csvText) as unknown as ParlGovPartyRaw[];

		const parties = records.map(parseParty).filter((p) => p.countryCode && p.nameNative);

		console.log(`[ParlGov] Parsed ${parties.length} parties`);
		return parties;
	} catch (error) {
		if (error instanceof ParlGovFetchError) {
			throw error;
		}
		throw new ParlGovFetchError(
			error instanceof Error ? error.message : 'Unknown error',
			url,
			error instanceof Error ? error : undefined
		);
	}
}

/**
 * Filtre les partis par codes pays
 *
 * @param parties - Liste complète des partis
 * @param countryCodes - Codes pays à inclure (ex: ['FRA', 'EUR'])
 * @returns Partis filtrés
 */
export function filterByCountry(parties: ParlGovParty[], countryCodes?: string[]): ParlGovParty[] {
	const codes = new Set(countryCodes || DEFAULT_COUNTRY_CODES);
	const filtered = parties.filter((p) => codes.has(p.countryCode));
	console.log(
		`[ParlGov] Filtered to ${filtered.length} parties for countries: ${[...codes].join(', ')}`
	);
	return filtered;
}

/**
 * Récupère les partis ParlGov pour les pays spécifiés
 *
 * @param config - Configuration optionnelle
 * @returns Partis filtrés par pays
 */
export async function fetchPartiesForCountries(
	config?: ParlGovClientConfig
): Promise<ParlGovParty[]> {
	const allParties = await fetchAllParties(config);
	return filterByCountry(allParties, config?.countryCodes);
}

/**
 * Teste la connexion à ParlGov
 *
 * @returns true si la connexion fonctionne
 */
export async function testConnection(): Promise<boolean> {
	console.log('[ParlGov] Testing connection...');

	try {
		const parties = await fetchAllParties({ timeout: 10000 });
		const franceParties = filterByCountry(parties, ['FRA']);

		console.log(`[ParlGov] ✓ Connection OK`);
		console.log(`[ParlGov]   Total parties: ${parties.length}`);
		console.log(`[ParlGov]   French parties: ${franceParties.length}`);

		// Afficher quelques exemples
		const samples = franceParties.slice(0, 5);
		console.log(`[ParlGov]   Samples:`);
		for (const p of samples) {
			console.log(
				`[ParlGov]     - ${p.shortName || 'N/A'}: ${p.nameNative} (L/R: ${p.leftRight ?? 'N/A'})`
			);
		}

		return true;
	} catch (error) {
		console.error('[ParlGov] ✗ Connection failed:', error);
		return false;
	}
}
