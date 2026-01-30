import { db, laws, scrutins } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { formatDate, logProgress } from '../../utils';
import { sql, desc, notLike } from 'drizzle-orm';
import type { NewLaw } from '../../../db';

const DOSLEG_CSV_URL = 'https://data.senat.fr/data/dosleg/dossiers-legislatifs.csv';

/**
 * Cache pour les législatures
 */
interface LegislatureDates {
	number: string;
	start: Date;
	end: Date | null;
}

let cachedLegislatures: LegislatureDates[] | null = null;

/**
 * Récupère les dates des législatures depuis la base de données
 * Utilise les scrutins AN pour déterminer les dates de début/fin
 */
async function getLegislatureDatesFromDb(): Promise<LegislatureDates[]> {
	if (cachedLegislatures) {
		return cachedLegislatures;
	}

	const result = await db
		.select({
			legislature: scrutins.legislature,
			minDate: sql<string>`min(${scrutins.date})`,
			maxDate: sql<string>`max(${scrutins.date})`
		})
		.from(scrutins)
		.where(notLike(scrutins.legislature, 'PE-%'))
		.groupBy(scrutins.legislature)
		.orderBy(desc(scrutins.legislature));

	cachedLegislatures = result.map((r, index) => ({
		number: r.legislature,
		start: new Date(r.minDate),
		end: index === 0 ? null : new Date(r.maxDate)
	}));

	return cachedLegislatures;
}

/**
 * Détermine la législature à partir d'une date
 * Utilise les données de la DB, avec fallback sur calcul approximatif
 */
async function getLegislatureFromDate(date: Date): Promise<string> {
	const legislatures = await getLegislatureDatesFromDb();

	// Chercher dans les données connues
	for (const leg of legislatures) {
		if (date >= leg.start && (leg.end === null || date <= leg.end)) {
			return leg.number;
		}
	}

	// Si la date est antérieure à nos données, calculer approximativement
	// Les législatures durent ~5 ans, la 12e a commencé en 2002
	const year = date.getFullYear();
	if (year < 2002) {
		// Approximation pour les anciennes législatures
		const approxLeg = Math.max(1, Math.floor((year - 1958) / 5) + 1);
		return String(approxLeg);
	}

	// Si la date est postérieure à nos données, utiliser la dernière législature connue
	// ou calculer approximativement
	if (legislatures.length > 0) {
		const latestLeg = parseInt(legislatures[0].number, 10);
		const latestYear = legislatures[0].start.getFullYear();
		const yearsAfter = year - latestYear;
		const additionalLegs = Math.floor(yearsAfter / 5);
		return String(latestLeg + additionalLegs);
	}

	// Fallback ultime basé sur l'année
	return String(Math.floor((year - 2002) / 5) + 12);
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

		// Déterminer la législature depuis la date de dépôt (async)
		const legislature = depositDate
			? await getLegislatureFromDate(depositDate)
			: String(Math.floor((new Date().getFullYear() - 2002) / 5) + 12);

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
