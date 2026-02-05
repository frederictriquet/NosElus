/**
 * ETL - Import de l'historique des mandats sénatoriaux
 * Source: data.senat.fr (ODSEN_ELUSEN.json)
 *
 * Ce script importe les mandats de sénateur (être élu sénateur) avec leurs
 * vraies dates de début et de fin, permettant le filtrage par renouvellement.
 */

import { db, actors, mandates } from '$lib/server/db';
import { sql, eq } from 'drizzle-orm';
import { type ETLConfig, type ImportStats, createImportStats } from '$lib/server/etl/types';
import { logProgress } from '$lib/server/etl/utils';
import type { NewMandate } from '$lib/server/db/schema/mandates';

const ODSEN_ELUSEN_URL = 'https://data.senat.fr/data/senateurs/ODSEN_ELUSEN.json';
const ODSEN_GENERAL_URL = 'https://data.senat.fr/data/senateurs/ODSEN_GENERAL.json';
const ODSEN_HISTOGROUPES_URL = 'https://data.senat.fr/data/senateurs/ODSEN_HISTOGROUPES.json';

// Types pour les données de l'API
interface MandatAPI {
	Matricule: string;
	Qualite: string;
	Nom_usuel: string;
	Prenom_usuel: string;
	Etat_Senateur: 'ACTIF' | 'ANCIEN';
	Identifiant_mandat: string;
	Date_d_election: string | null;
	Date_de_debut_de_mandat: string | null;
	Date_de_fin_de_mandat: string | null;
	Motif_debut_de_mandat: string | null;
	Motif_fin_de_mandat: string | null;
	Commentaire: string | null;
}

interface SenateurGeneralAPI {
	Matricule: string;
	Qualite: string;
	Nom_usuel: string;
	Prenom_usuel: string;
	Etat: 'ACTIF' | 'ANCIEN';
	Date_naissance: string | null;
	Date_de_deces: string | null;
	Groupe_politique: string | null;
	Circonscription: string | null;
	Categorie_professionnelle: string | null;
	Description_de_la_profession: string | null;
}

interface HistoGroupeAPI {
	Matricule: string;
	Id_appartenance: string;
	Code_du_groupe_politique: string;
	Nom_court_du_groupe_politique: string;
	Date_de_debut_d_appartenance: string | null;
	Date_de_fin_d_appartenance: string | null;
	Nom_court_fonction: string;
}

interface ODSENResponse<T> {
	results: T[];
}

function generateGroupId(code: string): string {
	return `GPSEN-${code}`;
}

function generateSenatorId(matricule: string): string {
	return `SEN-${matricule}`;
}

/**
 * Parse une date au format "YYYY/MM/DD HH:mm:ss" ou null
 */
function parseDate(dateStr: string | null): string | null {
	if (!dateStr) return null;
	// Format: "1983/09/25 00:00:00"
	const match = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
	if (!match) return null;
	return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Crée un mandat de sénateur à partir des données de l'API
 */
function createSenatorMandate(mandat: MandatAPI): NewMandate | null {
	const startDate = parseDate(mandat.Date_de_debut_de_mandat);
	if (!startDate) return null;

	const endDate = parseDate(mandat.Date_de_fin_de_mandat);

	return {
		id: `SEN-MANDAT-${mandat.Matricule}-${mandat.Identifiant_mandat}`,
		actorId: generateSenatorId(mandat.Matricule),
		organId: 'SENAT', // Le Sénat comme organe
		legislature: 'SENAT',
		type: 'senateur',
		quality: mandat.Motif_debut_de_mandat || 'Sénateur',
		startDate,
		endDate,
		constituency: null // La circonscription est dans ODSEN_GENERAL
	};
}

/**
 * Importe les sénateurs historiques (anciens sénateurs non présents dans l'API actuelle)
 */
async function importHistoricalSenators(
	generalData: SenateurGeneralAPI[],
	config: ETLConfig
): Promise<number> {
	// Récupérer les IDs des sénateurs déjà en base
	const existingIds = await db
		.select({ id: actors.id })
		.from(actors)
		.where(eq(actors.chamber, 'SENAT'));
	const existingIdSet = new Set(existingIds.map((r) => r.id));

	// Filtrer les sénateurs historiques non présents en base
	const newSenators = generalData
		.filter((s) => !existingIdSet.has(generateSenatorId(s.Matricule)))
		.map((s) => ({
			id: generateSenatorId(s.Matricule),
			uid: s.Matricule,
			firstName: s.Prenom_usuel,
			lastName: s.Nom_usuel,
			fullName: `${s.Prenom_usuel} ${s.Nom_usuel}`,
			civility: s.Qualite === 'Mme' ? 'Mme' : 'M.',
			chamber: 'SENAT' as const,
			birthDate: parseDate(s.Date_naissance),
			profession: s.Description_de_la_profession || s.Categorie_professionnelle,
			photoUrl: null // Pas de photo pour les anciens sénateurs via cette API
		}));

	if (newSenators.length === 0) {
		console.log('[Senat History] No new historical senators to import');
		return 0;
	}

	console.log(`[Senat History] Importing ${newSenators.length} historical senators...`);

	const batchSize = config.batchSize;
	for (let i = 0; i < newSenators.length; i += batchSize) {
		const batch = newSenators.slice(i, i + batchSize);

		try {
			await db
				.insert(actors)
				.values(batch)
				.onConflictDoUpdate({
					target: actors.id,
					set: {
						// Ne pas écraser les données existantes, juste mettre à jour si nécessaire
						updatedAt: sql`now()`
					}
				});
		} catch (error) {
			console.error(`[Senat History] Error inserting historical senators batch:`, error);
		}
	}

	return newSenators.length;
}

/**
 * Crée l'organe SENAT s'il n'existe pas (pour les mandats de sénateur)
 */
async function ensureSenatOrgan(): Promise<void> {
	const { organs } = await import('$lib/server/db');

	await db
		.insert(organs)
		.values({
			id: 'SENAT',
			uid: 'SENAT',
			name: 'Sénat',
			shortName: 'Sénat',
			type: 'ASSEMBLEE',
			chamber: 'SENAT'
		})
		.onConflictDoNothing();
}

/**
 * Importe les groupes politiques historiques
 */
async function importHistoricalGroups(groupsData: HistoGroupeAPI[]): Promise<number> {
	const { organs } = await import('$lib/server/db');

	// Extraire les groupes uniques
	const uniqueGroups = new Map<string, { code: string; name: string }>();
	for (const g of groupsData) {
		if (g.Code_du_groupe_politique && !uniqueGroups.has(g.Code_du_groupe_politique)) {
			uniqueGroups.set(g.Code_du_groupe_politique, {
				code: g.Code_du_groupe_politique,
				name: g.Nom_court_du_groupe_politique
			});
		}
	}

	const groupsList = Array.from(uniqueGroups.values()).map((g) => ({
		id: generateGroupId(g.code),
		uid: `SENAT-${g.code}`, // Prefix to avoid collision with AN groups
		name: g.name,
		shortName: g.code,
		type: 'GP' as const,
		chamber: 'SENAT' as const
	}));

	if (groupsList.length === 0) return 0;

	console.log(`[Senat History] Creating ${groupsList.length} political groups...`);
	console.log(`[Senat History] Groups to create: ${groupsList.map((g) => g.shortName).join(', ')}`);

	// Insérer un par un pour éviter les conflits de batch
	let inserted = 0;
	for (const group of groupsList) {
		try {
			await db
				.insert(organs)
				.values(group)
				.onConflictDoUpdate({
					target: organs.id,
					set: {
						name: sql`excluded.name`,
						updatedAt: sql`now()`
					}
				});
			inserted++;
		} catch (error) {
			const err = error as Error & { cause?: Error };
			console.error(
				`[Senat History] Error inserting group ${group.id}:`,
				err.cause?.message || err.message
			);
		}
	}

	return inserted;
}

/**
 * Crée les mandats de groupe (appartenance aux groupes politiques)
 * Dédoublonne par acteur+groupe+date de début
 */
function createGroupMandates(groupsData: HistoGroupeAPI[]): NewMandate[] {
	const seen = new Set<string>();
	const results: NewMandate[] = [];

	for (const g of groupsData) {
		if (!g.Code_du_groupe_politique) continue;

		// Utiliser une date par défaut si pas de date de début
		const startDate = parseDate(g.Date_de_debut_d_appartenance) || '1958-01-01';
		const endDate = parseDate(g.Date_de_fin_d_appartenance);

		// Clé unique basée sur acteur + groupe + date début
		const key = `${g.Matricule}-${g.Code_du_groupe_politique}-${startDate}`;
		if (seen.has(key)) continue;
		seen.add(key);

		results.push({
			id: `SEN-GP-${g.Matricule}-${g.Code_du_groupe_politique}-${startDate.replace(/-/g, '')}`,
			actorId: generateSenatorId(g.Matricule),
			organId: generateGroupId(g.Code_du_groupe_politique),
			legislature: 'SENAT',
			type: 'membre',
			quality: g.Nom_court_fonction || 'Membre',
			startDate,
			endDate,
			constituency: null
		});
	}

	return results;
}

/**
 * Import principal de l'historique des mandats
 */
export async function importSenatMandatesHistory(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[Senat History] Fetching mandates from data.senat.fr...');

	// Récupérer les mandats
	const mandatsResponse = await fetch(ODSEN_ELUSEN_URL);
	if (!mandatsResponse.ok) {
		throw new Error(
			`Failed to fetch mandates: ${mandatsResponse.status} ${mandatsResponse.statusText}`
		);
	}
	const mandatsData: ODSENResponse<MandatAPI> = await mandatsResponse.json();
	console.log(`[Senat History] Found ${mandatsData.results.length} mandates`);

	// Récupérer les infos générales (pour les sénateurs historiques)
	console.log('[Senat History] Fetching general senator data...');
	const generalResponse = await fetch(ODSEN_GENERAL_URL);
	if (!generalResponse.ok) {
		throw new Error(
			`Failed to fetch general data: ${generalResponse.status} ${generalResponse.statusText}`
		);
	}
	const generalData: ODSENResponse<SenateurGeneralAPI> = await generalResponse.json();
	console.log(`[Senat History] Found ${generalData.results.length} senators`);

	// Récupérer l'historique des groupes politiques
	console.log('[Senat History] Fetching political groups history...');
	const groupsResponse = await fetch(ODSEN_HISTOGROUPES_URL);
	if (!groupsResponse.ok) {
		throw new Error(
			`Failed to fetch groups data: ${groupsResponse.status} ${groupsResponse.statusText}`
		);
	}
	const groupsData: ODSENResponse<HistoGroupeAPI> = await groupsResponse.json();
	console.log(`[Senat History] Found ${groupsData.results.length} group memberships`);

	// Créer l'organe SENAT si nécessaire
	await ensureSenatOrgan();

	// Importer les groupes politiques historiques
	const groupsCount = await importHistoricalGroups(groupsData.results);
	console.log(`[Senat History] Imported ${groupsCount} political groups`);

	// Importer les sénateurs historiques
	const historicalCount = await importHistoricalSenators(generalData.results, config);
	console.log(`[Senat History] Imported ${historicalCount} historical senators`);

	// Créer les mandats
	const mandatesList = mandatsData.results
		.map(createSenatorMandate)
		.filter((m): m is NewMandate => m !== null);

	stats.total = mandatesList.length;
	console.log(`[Senat History] Creating ${mandatesList.length} senator mandates...`);

	const batchSize = config.batchSize;
	for (let i = 0; i < mandatesList.length; i += batchSize) {
		const batch = mandatesList.slice(i, i + batchSize);

		try {
			await db
				.insert(mandates)
				.values(batch)
				.onConflictDoUpdate({
					target: mandates.id,
					set: {
						startDate: sql`excluded.start_date`,
						endDate: sql`excluded.end_date`,
						quality: sql`excluded.quality`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[Senat History] Error inserting mandates batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 500 === 0 || i + batchSize >= mandatesList.length) {
			logProgress(stats, 'Senat History');
		}
	}

	// Créer les mandats de groupe (appartenance aux groupes politiques)
	const groupMandatesList = createGroupMandates(groupsData.results);
	console.log(`[Senat History] Creating ${groupMandatesList.length} group memberships...`);

	let groupMandatesInserted = 0;
	for (let i = 0; i < groupMandatesList.length; i += batchSize) {
		const batch = groupMandatesList.slice(i, i + batchSize);

		try {
			await db
				.insert(mandates)
				.values(batch)
				.onConflictDoUpdate({
					target: mandates.id,
					set: {
						startDate: sql`excluded.start_date`,
						endDate: sql`excluded.end_date`,
						quality: sql`excluded.quality`,
						updatedAt: sql`now()`
					}
				});

			groupMandatesInserted += batch.length;
		} catch (error) {
			console.error(`[Senat History] Error inserting group mandates batch:`, error);
		}
	}

	console.log(`[Senat History] Import complete:`);
	console.log(`  - Senator mandates: ${stats.inserted}`);
	console.log(`  - Group memberships: ${groupMandatesInserted}`);
	console.log(`  - Errors: ${stats.errors}`);

	// Ajouter les mandats de groupe au total
	stats.inserted += groupMandatesInserted;
	stats.total += groupMandatesList.length;

	return stats;
}
