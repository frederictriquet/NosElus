import { iterLoadAssembleeDossiersParlementaires } from '@tricoteuses/assemblee/loaders';
import type { DossierParlementaire, ActeLegislatif } from '@tricoteuses/assemblee';
import { CodeActe, type Legislature } from '@tricoteuses/assemblee';
import { db, laws, scrutins } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { formatDate, logProgress } from '../../utils';
import { sql, eq } from 'drizzle-orm';
import type { NewLaw } from '../../../db';

/**
 * Vérifie si un code d'acte est une adoption AN (AN1, AN2, AN3, etc.)
 */
function isAdoptionAN(codeActe: CodeActe): boolean {
	const codeStr = codeActe as string;
	return (
		codeStr.startsWith('AN') &&
		!codeStr.startsWith('ANLDEF') &&
		!codeStr.startsWith('ANLUNI') &&
		!codeStr.startsWith('ANNLEC')
	);
}

/**
 * Vérifie si un code d'acte est une adoption Sénat
 */
function isAdoptionSenat(codeActe: CodeActe): boolean {
	const codeStr = codeActe as string;
	return codeStr.startsWith('SN');
}

/**
 * Map un DossierParlementaire vers une Law
 */
export function mapDossierToLaw(dossier: DossierParlementaire): NewLaw {
	const titreDossier = dossier.titreDossier;
	const procedure = dossier.procedureParlementaire;

	// Trouver la date de dépôt (premier acte législatif)
	const firstActe = dossier.actesLegislatifs?.[0];
	const depositDate = firstActe?.dateActe ?? null;

	// Trouver les dates d'adoption et promulgation
	let adoptionDateAN: Date | null = null;
	let adoptionDateSenat: Date | null = null;
	let promulgationDate: Date | null = null;
	let publicationDate: string | null = null;

	// Parcourir récursivement les actes législatifs
	function processActes(actes: ActeLegislatif[] | undefined) {
		if (!actes) return;
		for (const acte of actes) {
			// Adoption AN
			if (isAdoptionAN(acte.codeActe) && acte.statutConclusion?.libelle === 'adopté') {
				adoptionDateAN = acte.dateActe ?? null;
			}
			// Adoption Sénat
			if (isAdoptionSenat(acte.codeActe) && acte.statutConclusion?.libelle === 'adopté') {
				adoptionDateSenat = acte.dateActe ?? null;
			}
			// Promulgation
			if (acte.codeActe === CodeActe.Prom) {
				promulgationDate = acte.dateActe ?? null;
			}
			// Publication JO
			if (acte.infoJo?.dateJo) {
				publicationDate = acte.infoJo.dateJo;
			}
			// Récursion dans les sous-actes
			processActes(acte.actesLegislatifs);
		}
	}
	processActes(dossier.actesLegislatifs);

	// Déterminer le statut
	let status = 'en cours';
	if (promulgationDate) {
		status = 'promulgué';
	} else if (adoptionDateAN || adoptionDateSenat) {
		status = 'adopté';
	}

	// Déterminer l'initiateur
	let initiator = null;
	if (dossier.initiateur?.organeRef) {
		initiator = 'gouvernement';
	} else if (dossier.initiateur?.acteurs && dossier.initiateur.acteurs.length > 0) {
		initiator = 'parlement';
	}

	// Type de procédure
	const type = procedure?.code || 'INCONNU';

	// URL source
	const sourceUrl = titreDossier.titreChemin
		? `https://www.assemblee-nationale.fr/dyn/${dossier.legislature}/dossiers/${titreDossier.titreChemin}`
		: null;

	return {
		id: dossier.uid,
		uid: dossier.uid,
		number: extractNumberFromUid(dossier.uid),
		legislature: dossier.legislature,
		title: titreDossier.titre,
		shortTitle: null, // Pas disponible dans TitreDossier
		type,
		status,
		depositDate: formatDate(depositDate),
		adoptionDateAN: formatDate(adoptionDateAN),
		adoptionDateSenat: formatDate(adoptionDateSenat),
		promulgationDate: formatDate(promulgationDate),
		publicationDate: publicationDate,
		theme: null, // Pas disponible dans les données brutes
		subThemes: null,
		initiator,
		description: null,
		sourceUrl
	};
}

function extractNumberFromUid(uid: string): string | null {
	// Format: DLR5L17N12345 -> 12345
	const match = uid.match(/N(\d+)$/);
	return match ? match[1] : null;
}

/**
 * Extrait les références de scrutins depuis un dossier parlementaire (récursivement)
 */
export function extractScrutinRefs(dossier: DossierParlementaire): string[] {
	const refs: string[] = [];

	function processActes(actes: ActeLegislatif[] | undefined) {
		if (!actes) return;
		for (const acte of actes) {
			if (acte.voteRefs) {
				refs.push(...acte.voteRefs);
			}
			// Parcourir récursivement les sous-actes
			processActes(acte.actesLegislatifs);
		}
	}

	processActes(dossier.actesLegislatifs);
	return refs;
}

/**
 * Import des dossiers législatifs
 */
export async function importLaws(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();
	const legislature = parseInt(config.legislature, 10) as Legislature;

	if (!config.dataDir) {
		throw new Error('ETL_DATA_DIR is required for importing laws from @tricoteuses/assemblee');
	}

	console.log(`[Laws] Starting import for legislature ${legislature}...`);

	const lawsList: NewLaw[] = [];
	const scrutinToLawMap = new Map<string, string>();

	// Load dossiers from data directory
	for (const { dossierParlementaire } of iterLoadAssembleeDossiersParlementaires(
		config.dataDir,
		legislature
	)) {
		const law = mapDossierToLaw(dossierParlementaire);
		lawsList.push(law);

		// Build mapping of scrutin -> law
		const scrutinRefs = extractScrutinRefs(dossierParlementaire);
		for (const scrutinRef of scrutinRefs) {
			scrutinToLawMap.set(scrutinRef, law.id);
		}
	}

	console.log(`[Laws] Found ${lawsList.length} dossiers législatifs`);
	console.log(`[Laws] Found ${scrutinToLawMap.size} scrutin-law mappings`);
	stats.total = lawsList.length;

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
						adoptionDateAN: sql`excluded.adoption_date_an`,
						adoptionDateSenat: sql`excluded.adoption_date_senat`,
						promulgationDate: sql`excluded.promulgation_date`,
						publicationDate: sql`excluded.publication_date`,
						sourceUrl: sql`excluded.source_url`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[Laws] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 500 === 0 || i + batchSize >= lawsList.length) {
			logProgress(stats, 'Laws');
		}
	}

	return stats;
}

/**
 * Lier les scrutins aux dossiers législatifs
 */
export async function linkScrutinsToLaws(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();
	const legislature = parseInt(config.legislature, 10) as Legislature;

	if (!config.dataDir) {
		throw new Error('ETL_DATA_DIR is required');
	}

	console.log(`[Link Scrutins→Laws] Starting for legislature ${legislature}...`);

	// Build mapping of scrutin -> law from dossiers
	const scrutinToLawMap = new Map<string, string>();

	for (const { dossierParlementaire } of iterLoadAssembleeDossiersParlementaires(
		config.dataDir,
		legislature
	)) {
		const scrutinRefs = extractScrutinRefs(dossierParlementaire);
		for (const scrutinRef of scrutinRefs) {
			scrutinToLawMap.set(scrutinRef, dossierParlementaire.uid);
		}
	}

	console.log(`[Link Scrutins→Laws] Found ${scrutinToLawMap.size} mappings`);
	stats.total = scrutinToLawMap.size;

	// Update scrutins in batches
	const entries = Array.from(scrutinToLawMap.entries());
	const batchSize = 100;

	for (let i = 0; i < entries.length; i += batchSize) {
		const batch = entries.slice(i, i + batchSize);

		for (const [scrutinId, lawId] of batch) {
			try {
				// Vérifier d'abord si le scrutin existe
				const existing = await db
					.select({ id: scrutins.id })
					.from(scrutins)
					.where(eq(scrutins.id, scrutinId))
					.limit(1);

				if (existing.length > 0) {
					await db
						.update(scrutins)
						.set({ lawId, updatedAt: new Date() })
						.where(eq(scrutins.id, scrutinId));
					stats.updated++;
				} else {
					stats.skipped++;
				}
			} catch (error) {
				stats.errors++;
			}
		}

		if ((i + batchSize) % 500 === 0 || i + batchSize >= entries.length) {
			logProgress(stats, 'Link Scrutins→Laws');
		}
	}

	return stats;
}
