import { db, actors, organs, mandates } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql, eq } from 'drizzle-orm';
import type { NewActor, NewOrgan, NewMandate } from '../../../db';
import { SENAT_SOURCES } from '../../config';

const SENAT_API_URL = SENAT_SOURCES.senatorsApiUrl;

interface SenateurAPI {
	matricule: string;
	nom: string;
	prenom: string;
	civilite: string;
	feminise: boolean;
	serie: string;
	siege: number;
	url: string;
	urlAvatar: string;
	twitter?: string;
	facebook?: string;
	groupe?: {
		code: string;
		libelle: string;
		ordre: number;
	};
	circonscription?: {
		code: string;
		libelle: string;
		ordre: number;
	};
	categorieProfessionnelle?: {
		code: string;
		libelle: string;
		ordre: number;
	};
	organismes?: Array<{
		code: string;
		type: string;
		libelle: string;
		ordre: number;
	}>;
}

/**
 * Génère un ID unique pour un sénateur
 */
function generateSenatorId(matricule: string): string {
	return `SEN-${matricule}`;
}

/**
 * Génère un ID unique pour un groupe du Sénat
 */
function generateGroupId(code: string): string {
	return `GPSEN-${code}`;
}

/**
 * Mappe un sénateur vers un Actor
 */
function mapSenatorToActor(senator: SenateurAPI): NewActor {
	const id = generateSenatorId(senator.matricule);

	return {
		id,
		uid: senator.matricule,
		civility: senator.civilite || null,
		firstName: senator.prenom,
		lastName: senator.nom,
		fullName: `${senator.prenom} ${senator.nom}`,
		birthDate: null, // Non disponible dans l'API
		birthPlace: null,
		profession: senator.categorieProfessionnelle?.libelle || null,
		photoUrl: senator.urlAvatar ? `https://www.senat.fr${senator.urlAvatar}` : null,
		chamber: 'SENAT'
	};
}

/**
 * Extrait les groupes uniques des sénateurs
 */
function extractGroups(senators: SenateurAPI[]): NewOrgan[] {
	const groupMap = new Map<string, NewOrgan>();

	for (const senator of senators) {
		if (senator.groupe && !groupMap.has(senator.groupe.code)) {
			groupMap.set(senator.groupe.code, {
				id: generateGroupId(senator.groupe.code),
				uid: `SENAT-${senator.groupe.code}`, // Préfixer pour éviter collision avec AN
				type: 'GP', // Groupe Parlementaire
				name: senator.groupe.libelle,
				shortName: senator.groupe.code,
				legislature: 'SENAT', // Le Sénat n'a pas de législature au sens de l'AN
				chamber: 'SENAT',
				startDate: null,
				endDate: null,
				color: null
			});
		}
	}

	return Array.from(groupMap.values());
}

/**
 * Crée un mandat de groupe pour un sénateur
 */
function createGroupMandate(senator: SenateurAPI): NewMandate | null {
	if (!senator.groupe) return null;

	// Date de début par défaut : début de la législature actuelle du Sénat
	// (Les sénateurs en exercice sont ceux élus depuis 2020 au minimum)
	const defaultStartDate = '2020-09-27'; // Renouvellement partiel 2020

	return {
		id: `${generateSenatorId(senator.matricule)}-${generateGroupId(senator.groupe.code)}`,
		actorId: generateSenatorId(senator.matricule),
		organId: generateGroupId(senator.groupe.code),
		legislature: 'SENAT',
		type: 'membre',
		quality: 'Membre',
		startDate: defaultStartDate,
		endDate: null,
		constituency: senator.circonscription?.libelle || null
	};
}

/**
 * Import des sénateurs depuis l'API du Sénat
 */
export async function importSenators(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[Senat Senators] Fetching from API...');

	const response = await fetch(SENAT_API_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch senators: ${response.status} ${response.statusText}`);
	}

	const senators: SenateurAPI[] = await response.json();
	console.log(`[Senat Senators] Found ${senators.length} sénateurs`);
	stats.total = senators.length;

	// Extraire et insérer les groupes
	const groups = extractGroups(senators);
	console.log(`[Senat Senators] Found ${groups.length} groupes politiques`);

	if (groups.length > 0) {
		try {
			await db
				.insert(organs)
				.values(groups)
				.onConflictDoUpdate({
					target: organs.id,
					set: {
						name: sql`excluded.name`,
						shortName: sql`excluded.short_name`,
						updatedAt: sql`now()`
					}
				});
			console.log(`[Senat Senators] Inserted ${groups.length} groupes`);
		} catch (error) {
			console.error('[Senat Senators] Error inserting groups:', error);
		}
	}

	// Insérer les sénateurs
	const actorsList = senators.map(mapSenatorToActor);

	const batchSize = config.batchSize;
	for (let i = 0; i < actorsList.length; i += batchSize) {
		const batch = actorsList.slice(i, i + batchSize);

		try {
			await db
				.insert(actors)
				.values(batch)
				.onConflictDoUpdate({
					target: actors.id,
					set: {
						firstName: sql`excluded.first_name`,
						lastName: sql`excluded.last_name`,
						fullName: sql`excluded.full_name`,
						civility: sql`excluded.civility`,
						profession: sql`excluded.profession`,
						photoUrl: sql`excluded.photo_url`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[Senat Senators] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 100 === 0 || i + batchSize >= actorsList.length) {
			logProgress(stats, 'Senat Senators');
		}
	}

	// Créer les mandats de groupe
	const mandatesList = senators.map(createGroupMandate).filter((m): m is NewMandate => m !== null);

	console.log(`[Senat Senators] Creating ${mandatesList.length} mandates...`);

	for (let i = 0; i < mandatesList.length; i += batchSize) {
		const batch = mandatesList.slice(i, i + batchSize);

		try {
			await db
				.insert(mandates)
				.values(batch)
				.onConflictDoUpdate({
					target: mandates.id,
					set: {
						constituency: sql`excluded.constituency`,
						updatedAt: sql`now()`
					}
				});
		} catch (error) {
			console.error(`[Senat Senators] Error inserting mandates batch:`, error);
		}
	}

	console.log(
		`[Senat Senators] Import complete: ${stats.inserted} inserted, ${stats.errors} errors`
	);

	return stats;
}
