/**
 * ETL : Import des dossiers législatifs depuis les fichiers JSON de l'AN
 * Source : data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/
 */

import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { db, laws, lawCosignatories, actors } from '../db';
import { eq, sql, inArray } from 'drizzle-orm';
import type { NewLaw, NewLawCosignatory } from '../db';

interface DossierParlementaire {
	uid: string;
	legislature: string;
	titreDossier: {
		titre: string;
		titreChemin?: string;
	};
	procedureParlementaire?: {
		code: string;
		libelle: string;
	};
	initiateur?: {
		acteurs?: {
			acteur: ActeurRef | ActeurRef[];
		};
	};
	actesLegislatifs?: {
		acteLegislatif: ActeLegislatif | ActeLegislatif[];
	};
}

interface ActeurRef {
	acteurRef: string;
	mandatRef?: string;
}

interface ActeLegislatif {
	uid: string;
	codeActe: string;
	dateActe?: string;
	actesLegislatifs?: {
		acteLegislatif: ActeLegislatif | ActeLegislatif[];
	};
}

interface DocumentAN {
	uid: string;
	legislature: string;
	titres?: {
		titrePrincipal?: string;
		titrePrincipalCourt?: string;
	};
	cycleDeVie?: {
		chrono?: {
			dateCreation?: string;
			dateDepot?: string;
			datePublication?: string;
		};
	};
	classification?: {
		type?: { code: string; libelle: string };
		famille?: {
			classe?: { code: string; libelle: string };
		};
	};
	auteurs?: {
		auteur: AuteurDoc | AuteurDoc[];
	};
	dossierRef?: string;
}

interface AuteurDoc {
	acteur?: {
		acteurRef: string;
		qualite?: string;
	};
}

/**
 * Extrait la première date d'un acte législatif (récursif)
 */
function extractFirstDate(actes: ActeLegislatif | ActeLegislatif[] | undefined): string | null {
	if (!actes) return null;

	const actesList = Array.isArray(actes) ? actes : [actes];

	for (const acte of actesList) {
		if (acte.dateActe) {
			// Format: "2026-01-27T00:00:00.000+01:00" -> "2026-01-27"
			return acte.dateActe.split('T')[0];
		}
		// Récursion
		const nested = extractFirstDate(acte.actesLegislatifs?.acteLegislatif);
		if (nested) return nested;
	}

	return null;
}

/**
 * Map le type de procédure vers notre format
 */
function mapProcedureType(procedure?: { code: string; libelle: string }): string {
	if (!procedure) return 'AUTRE';

	const libelle = procedure.libelle.toLowerCase();

	if (libelle.includes('projet de loi de finances')) return 'PLF';
	if (libelle.includes('financement de la sécurité sociale')) return 'PLFSS';
	if (libelle.includes('projet de loi organique')) return 'PJLO';
	if (libelle.includes('projet de loi')) return 'PJL';
	if (libelle.includes('proposition de loi organique')) return 'PPLO';
	if (libelle.includes('proposition de loi')) return 'PPL';
	if (libelle.includes('proposition de résolution')) return 'PRES';

	return 'AUTRE';
}

export interface ImportDossiersStats {
	dossiersProcessed: number;
	dossiersCreated: number;
	dossiersUpdated: number;
	documentsProcessed: number;
	cosignatoriesCreated: number;
	errors: number;
}

/**
 * Import les dossiers législatifs depuis les fichiers JSON
 */
export async function importDossiersAN(
	dataDir: string,
	legislature: string
): Promise<ImportDossiersStats> {
	const stats: ImportDossiersStats = {
		dossiersProcessed: 0,
		dossiersCreated: 0,
		dossiersUpdated: 0,
		documentsProcessed: 0,
		cosignatoriesCreated: 0,
		errors: 0
	};

	console.log(`[Import Dossiers AN] Starting for legislature ${legislature}...`);
	console.log(`[Import Dossiers AN] Data dir: ${dataDir}`);

	const dossierDir = path.join(dataDir, 'json', 'dossierParlementaire');
	const documentDir = path.join(dataDir, 'json', 'document');

	// Récupérer les acteurs existants pour validation
	const existingActors = await db.select({ id: actors.id }).from(actors);
	const actorIds = new Set(existingActors.map((a) => a.id));
	console.log(`[Import Dossiers AN] ${actorIds.size} actors in database`);

	// Phase 1: Importer les dossiers parlementaires
	console.log(`[Import Dossiers AN] Phase 1: Importing dossiers...`);

	const dossierFiles = await readdir(dossierDir);
	const lawsToInsert: NewLaw[] = [];
	const cosignatoriesToInsert: NewLawCosignatory[] = [];

	for (const file of dossierFiles) {
		if (!file.endsWith('.json')) continue;

		try {
			const content = await readFile(path.join(dossierDir, file), 'utf-8');
			const data = JSON.parse(content);
			const dossier: DossierParlementaire = data.dossierParlementaire;

			if (!dossier || dossier.legislature !== legislature) continue;

			stats.dossiersProcessed++;

			const depositDate = extractFirstDate(dossier.actesLegislatifs?.acteLegislatif);

			const newLaw: NewLaw = {
				id: dossier.uid,
				uid: dossier.uid,
				legislature: dossier.legislature,
				title: dossier.titreDossier.titre,
				shortTitle:
					dossier.titreDossier.titre.length > 100
						? dossier.titreDossier.titre.substring(0, 97) + '...'
						: dossier.titreDossier.titre,
				type: mapProcedureType(dossier.procedureParlementaire),
				depositDate,
				initiator: dossier.procedureParlementaire?.libelle.toLowerCase().includes('projet')
					? 'gouvernement'
					: 'assemblée',
				sourceUrl: `https://www.assemblee-nationale.fr/dyn/${legislature}/dossiers/${dossier.uid}`
			};

			lawsToInsert.push(newLaw);

			// Ajouter les initiateurs comme auteurs
			if (dossier.initiateur?.acteurs?.acteur) {
				const initActeurs = Array.isArray(dossier.initiateur.acteurs.acteur)
					? dossier.initiateur.acteurs.acteur
					: [dossier.initiateur.acteurs.acteur];

				let order = 1;
				for (const acteur of initActeurs) {
					if (acteur.acteurRef && actorIds.has(acteur.acteurRef)) {
						cosignatoriesToInsert.push({
							lawId: dossier.uid,
							actorId: acteur.acteurRef,
							role: 'author',
							signatureOrder: order++
						});
					}
				}
			}
		} catch (error) {
			console.error(`[Import Dossiers AN] Error processing ${file}:`, error);
			stats.errors++;
		}

		if (stats.dossiersProcessed % 500 === 0) {
			console.log(`[Import Dossiers AN] Processed ${stats.dossiersProcessed} dossiers...`);
		}
	}

	// Phase 2: Importer les documents (pour les auteurs supplémentaires)
	console.log(`[Import Dossiers AN] Phase 2: Processing documents for authors...`);

	const documentFiles = await readdir(documentDir);
	const dossierIds = new Set(lawsToInsert.map((l) => l.id));

	for (const file of documentFiles) {
		if (!file.endsWith('.json')) continue;

		try {
			const content = await readFile(path.join(documentDir, file), 'utf-8');
			const data = JSON.parse(content);
			const doc: DocumentAN = data.document;

			if (!doc || doc.legislature !== legislature || !doc.dossierRef) continue;
			if (!dossierIds.has(doc.dossierRef)) continue;

			stats.documentsProcessed++;

			// Ajouter les auteurs du document
			if (doc.auteurs?.auteur) {
				const auteurs = Array.isArray(doc.auteurs.auteur)
					? doc.auteurs.auteur
					: [doc.auteurs.auteur];

				let order = 1;
				for (const auteur of auteurs) {
					if (auteur.acteur?.acteurRef && actorIds.has(auteur.acteur.acteurRef)) {
						const role = auteur.acteur.qualite === 'cosignataire' ? 'cosignatory' : 'author';

						// Vérifier si déjà ajouté
						const exists = cosignatoriesToInsert.some(
							(c) => c.lawId === doc.dossierRef && c.actorId === auteur.acteur!.acteurRef
						);

						if (!exists) {
							cosignatoriesToInsert.push({
								lawId: doc.dossierRef!,
								actorId: auteur.acteur.acteurRef,
								role,
								signatureOrder: order++
							});
						}
					}
				}
			}
		} catch (error) {
			// Silently skip invalid documents
		}

		if (stats.documentsProcessed % 1000 === 0) {
			console.log(`[Import Dossiers AN] Processed ${stats.documentsProcessed} documents...`);
		}
	}

	// Phase 3: Insérer les dossiers
	console.log(`[Import Dossiers AN] Phase 3: Inserting ${lawsToInsert.length} dossiers...`);

	const batchSize = 100;
	for (let i = 0; i < lawsToInsert.length; i += batchSize) {
		const batch = lawsToInsert.slice(i, i + batchSize);

		try {
			const result = await db
				.insert(laws)
				.values(batch)
				.onConflictDoUpdate({
					target: laws.id,
					set: {
						title: sql`excluded.title`,
						shortTitle: sql`excluded.short_title`,
						type: sql`excluded.type`,
						depositDate: sql`excluded.deposit_date`,
						sourceUrl: sql`excluded.source_url`,
						updatedAt: sql`now()`
					}
				})
				.returning({ id: laws.id });

			stats.dossiersCreated += result.length;
		} catch (error) {
			console.error(`[Import Dossiers AN] Error inserting batch:`, error);
			stats.errors++;
		}
	}

	// Phase 4: Insérer les cosignataires
	console.log(
		`[Import Dossiers AN] Phase 4: Inserting ${cosignatoriesToInsert.length} cosignatories...`
	);

	// Supprimer les anciens cosignataires pour cette législature
	const lawIds = lawsToInsert.map((l) => l.id).filter((id): id is string => id !== undefined);
	if (lawIds.length > 0) {
		await db.delete(lawCosignatories).where(inArray(lawCosignatories.lawId, lawIds));
	}

	for (let i = 0; i < cosignatoriesToInsert.length; i += batchSize) {
		const batch = cosignatoriesToInsert.slice(i, i + batchSize);

		try {
			await db.insert(lawCosignatories).values(batch).onConflictDoNothing();
			stats.cosignatoriesCreated += batch.length;
		} catch (error) {
			console.error(`[Import Dossiers AN] Error inserting cosignatories:`, error);
			stats.errors++;
		}
	}

	console.log(`[Import Dossiers AN] Done!`);
	console.log(`  Dossiers processed: ${stats.dossiersProcessed}`);
	console.log(`  Dossiers created/updated: ${stats.dossiersCreated}`);
	console.log(`  Documents processed: ${stats.documentsProcessed}`);
	console.log(`  Cosignatories created: ${stats.cosignatoriesCreated}`);
	console.log(`  Errors: ${stats.errors}`);

	return stats;
}
