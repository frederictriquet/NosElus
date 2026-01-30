import { db, laws } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { formatDate, logProgress } from '../../utils';
import { sql } from 'drizzle-orm';
import type { NewLaw } from '../../../db';

const DOSLEG_CSV_URL = 'https://data.senat.fr/data/dosleg/dossiers-legislatifs.csv';

/**
 * Mapping des législatures par dates
 * Les législatures correspondent aux mandats de l'Assemblée Nationale
 */
const LEGISLATURES: { start: Date; end: Date | null; number: string }[] = [
	{ start: new Date('1958-12-09'), end: new Date('1962-10-09'), number: '1' },
	{ start: new Date('1962-11-25'), end: new Date('1967-04-03'), number: '2' },
	{ start: new Date('1967-04-03'), end: new Date('1968-05-30'), number: '3' },
	{ start: new Date('1968-07-11'), end: new Date('1973-04-02'), number: '4' },
	{ start: new Date('1973-04-02'), end: new Date('1978-04-02'), number: '5' },
	{ start: new Date('1978-04-02'), end: new Date('1981-05-22'), number: '6' },
	{ start: new Date('1981-07-02'), end: new Date('1986-04-02'), number: '7' },
	{ start: new Date('1986-04-02'), end: new Date('1988-05-14'), number: '8' },
	{ start: new Date('1988-06-13'), end: new Date('1993-04-02'), number: '9' },
	{ start: new Date('1993-04-02'), end: new Date('1997-04-21'), number: '10' },
	{ start: new Date('1997-06-01'), end: new Date('2002-06-19'), number: '11' },
	{ start: new Date('2002-06-19'), end: new Date('2007-06-20'), number: '12' },
	{ start: new Date('2007-06-20'), end: new Date('2012-06-20'), number: '13' },
	{ start: new Date('2012-06-20'), end: new Date('2017-06-21'), number: '14' },
	{ start: new Date('2017-06-21'), end: new Date('2022-06-22'), number: '15' },
	{ start: new Date('2022-06-22'), end: new Date('2024-07-18'), number: '16' },
	{ start: new Date('2024-07-18'), end: null, number: '17' }
];

/**
 * Détermine la législature à partir d'une date
 */
function getLegislatureFromDate(date: Date): string {
	for (const leg of LEGISLATURES) {
		if (date >= leg.start && (leg.end === null || date < leg.end)) {
			return leg.number;
		}
	}
	// Par défaut, retourner la dernière législature connue
	return '17';
}

/**
 * Parse une date au format JJ/MM/AAAA
 */
function parseFrenchDate(dateStr: string): Date | null {
	if (!dateStr || dateStr.trim() === '') return null;
	const parts = dateStr.split('/');
	if (parts.length !== 3) return null;
	const [day, month, year] = parts;
	const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
	if (isNaN(date.getTime())) return null;
	return date;
}

/**
 * Extrait l'ID du dossier depuis l'URL
 */
function extractIdFromUrl(url: string): string {
	// http://www.senat.fr/dossier-legislatif/airfrance.html -> SEN-airfrance
	const match = url.match(/dossier-legislatif\/([^.]+)\.html/);
	if (match) {
		return `SEN-${match[1]}`;
	}
	// Fallback: hash de l'URL
	return `SEN-${url.split('/').pop()?.replace('.html', '') || 'unknown'}`;
}

/**
 * Mappe le type de dossier vers notre nomenclature
 */
function mapDossierType(typeStr: string): string {
	const type = typeStr.toLowerCase();
	if (type.includes('projet de loi constitutionnel')) return 'PJLC';
	if (type.includes('projet de loi organique')) return 'PJLO';
	if (type.includes('projet de loi de finances')) return 'PJLF';
	if (type.includes('projet de loi')) return 'PJL';
	if (type.includes('proposition de loi constitutionnelle')) return 'PPLC';
	if (type.includes('proposition de loi organique')) return 'PPLO';
	if (type.includes('proposition de loi')) return 'PPL';
	if (type.includes('proposition de résolution')) return 'PPRES';
	if (type.includes('motion référendaire')) return 'MREF';
	return 'AUTRE';
}

/**
 * Mappe le statut du dossier
 */
function mapStatus(statusStr: string): string {
	const status = statusStr.toLowerCase();
	if (status === 'promulgué') return 'promulgué';
	if (status === 'non adopté') return 'rejeté';
	if (status === 'caduc') return 'caduc';
	if (status === 'non conforme') return 'non conforme';
	if (status.includes('lecture')) return 'en cours';
	if (status.includes('cmp')) return 'en cours';
	if (status.includes('congrès')) return 'en cours';
	if (status.includes('poursuivi')) return 'fusionné';
	return 'en cours';
}

/**
 * Parse le CSV et retourne les dossiers
 */
async function fetchAndParseCsv(): Promise<NewLaw[]> {
	console.log(`[Senat Laws] Fetching CSV from ${DOSLEG_CSV_URL}...`);

	const response = await fetch(DOSLEG_CSV_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
	}

	// Le fichier est encodé en ISO-8859-1
	const buffer = await response.arrayBuffer();
	const decoder = new TextDecoder('iso-8859-1');
	const csvText = decoder.decode(buffer);

	const lines = csvText.split('\n');
	const header = lines[0];
	console.log(`[Senat Laws] CSV header: ${header}`);
	console.log(`[Senat Laws] Found ${lines.length - 1} records`);

	const laws: NewLaw[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		// Parse CSV avec gestion des guillemets
		const fields = parseCSVLine(line);
		if (fields.length < 10) continue;

		const [
			titre,
			typeDossier,
			dateInitiale,
			urlDossier,
			etatDossier,
			decisionCC,
			dateDecision,
			datePromulgation,
			numeroLoi,
			themes
		] = fields;

		const depositDate = parseFrenchDate(dateInitiale);
		const promulgationDate = parseFrenchDate(datePromulgation);

		// Déterminer la législature depuis la date de dépôt
		const legislature = depositDate ? getLegislatureFromDate(depositDate) : '17';

		const id = extractIdFromUrl(urlDossier);

		// Créer une description avec les infos CC si disponibles
		let description = null;
		if (decisionCC && decisionCC.trim()) {
			const dateCC = dateDecision ? ` (${dateDecision})` : '';
			description = `Décision du Conseil constitutionnel: ${decisionCC}${dateCC}`;
		}

		// Tronquer le thème à 200 caractères max (limite DB)
		let theme = themes?.replace(/^"|"$/g, '') || null;
		if (theme && theme.length > 200) {
			theme = theme.substring(0, 197) + '...';
		}

		laws.push({
			id,
			uid: id,
			number: numeroLoi || null,
			legislature,
			title: titre.replace(/^"|"$/g, ''),
			shortTitle: null,
			type: mapDossierType(typeDossier),
			status: mapStatus(etatDossier),
			depositDate: formatDate(depositDate),
			adoptionDateAN: null,
			adoptionDateSenat: null,
			promulgationDate: formatDate(promulgationDate),
			publicationDate: null,
			theme,
			subThemes: null,
			initiator: typeDossier.toLowerCase().includes('projet') ? 'gouvernement' : 'parlement',
			description,
			sourceUrl: urlDossier
		});
	}

	return laws;
}

/**
 * Parse une ligne CSV avec gestion des guillemets
 */
function parseCSVLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Guillemet échappé
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ';' && !inQuotes) {
			fields.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}
	fields.push(current.trim());

	return fields;
}

/**
 * Import des dossiers législatifs du Sénat
 */
export async function importSenatLaws(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[Senat Laws] Starting import...');

	try {
		const lawsList = await fetchAndParseCsv();
		stats.total = lawsList.length;

		console.log(`[Senat Laws] Importing ${lawsList.length} dossiers législatifs...`);

		// Insert laws in batches
		const batchSize = config.batchSize;
		for (let i = 0; i < lawsList.length; i += batchSize) {
			const batch = lawsList.slice(i, i + batchSize);

			try {
				await db
					.insert(laws)
					.values(batch)
					.onConflictDoUpdate({
						target: laws.id,
						set: {
							title: sql`excluded.title`,
							shortTitle: sql`excluded.short_title`,
							status: sql`excluded.status`,
							promulgationDate: sql`excluded.promulgation_date`,
							theme: sql`excluded.theme`,
							description: sql`excluded.description`,
							sourceUrl: sql`excluded.source_url`,
							updatedAt: sql`now()`
						}
					});

				stats.inserted += batch.length;
			} catch (error) {
				console.error(`[Senat Laws] Error inserting batch:`, error);
				stats.errors += batch.length;
			}

			if ((i + batchSize) % 1000 === 0 || i + batchSize >= lawsList.length) {
				logProgress(stats, 'Senat Laws');
			}
		}

		console.log(`[Senat Laws] Import complete: ${stats.inserted} inserted, ${stats.errors} errors`);
	} catch (error) {
		console.error('[Senat Laws] Import failed:', error);
		throw error;
	}

	return stats;
}
