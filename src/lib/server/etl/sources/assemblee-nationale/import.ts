import { db, actors, organs, mandates } from '../../../db';
import { downloadAndExtractData, loadActeurs, loadOrganes, filterDeputes } from './loader';
import { mapActeur, mapOrgane, mapActeurMandats, getActeurLegislatures } from './mappers';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';

/**
 * Importe les organes essentiels (ASSEMBLEE + GP) depuis les données AN
 */
export async function importOrganesFromAN(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	await downloadAndExtractData();

	console.log('[AN] Loading organes...');
	const organes = await loadOrganes();

	// Filter to essential types: ASSEMBLEE (legislatures) + GP (groupes parlementaires)
	const essentialOrganes = organes.filter(
		(o) => o.organe.codeType === 'GP' || o.organe.codeType === 'ASSEMBLEE'
	);
	console.log(`[AN] Found ${essentialOrganes.length} organes essentiels (ASSEMBLEE + GP)`);

	stats.total = essentialOrganes.length;

	const batchSize = config.batchSize;
	for (let i = 0; i < essentialOrganes.length; i += batchSize) {
		const batch = essentialOrganes.slice(i, i + batchSize);
		const mappedOrgans = batch.map(mapOrgane);

		try {
			await db
				.insert(organs)
				.values(mappedOrgans)
				.onConflictDoUpdate({
					target: organs.id,
					set: {
						name: sql`excluded.name`,
						shortName: sql`excluded.short_name`,
						color: sql`excluded.color`,
						startDate: sql`excluded.start_date`,
						endDate: sql`excluded.end_date`,
						legislature: sql`excluded.legislature`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[AN] Error inserting organes:`, error);
			stats.errors += batch.length;
		}
	}

	logProgress(stats, 'Organes AN');
	return stats;
}

/**
 * Importe les groupes parlementaires historiques depuis les données AN
 * @deprecated Utilisez importOrganesFromAN à la place
 */
export async function importGroupesFromAN(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	await downloadAndExtractData();

	console.log('[AN] Loading groupes parlementaires...');
	const organes = await loadOrganes();
	const groupes = organes.filter((o) => o.organe.codeType === 'GP');
	console.log(`[AN] Found ${groupes.length} groupes parlementaires`);

	stats.total = groupes.length;

	const batchSize = config.batchSize;
	for (let i = 0; i < groupes.length; i += batchSize) {
		const batch = groupes.slice(i, i + batchSize);
		const mappedOrgans = batch.map(mapOrgane);

		try {
			await db
				.insert(organs)
				.values(mappedOrgans)
				.onConflictDoUpdate({
					target: organs.id,
					set: {
						name: sql`excluded.name`,
						shortName: sql`excluded.short_name`,
						color: sql`excluded.color`,
						startDate: sql`excluded.start_date`,
						endDate: sql`excluded.end_date`,
						legislature: sql`excluded.legislature`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[AN] Error inserting groupes:`, error);
			stats.errors += batch.length;
		}
	}

	logProgress(stats, 'Groupes AN');
	return stats;
}

/**
 * Importe les députés historiques depuis les données AN
 */
export async function importDeputesFromAN(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	await downloadAndExtractData();

	console.log('[AN] Loading acteurs...');
	const allActeurs = await loadActeurs();
	const deputes = filterDeputes(allActeurs);
	console.log(`[AN] Found ${deputes.length} députés (out of ${allActeurs.length} acteurs)`);

	stats.total = deputes.length;

	const batchSize = config.batchSize;
	for (let i = 0; i < deputes.length; i += batchSize) {
		const batch = deputes.slice(i, i + batchSize);
		const mappedActors = batch.map(mapActeur);

		try {
			await db
				.insert(actors)
				.values(mappedActors)
				.onConflictDoUpdate({
					target: actors.id,
					set: {
						firstName: sql`excluded.first_name`,
						lastName: sql`excluded.last_name`,
						fullName: sql`excluded.full_name`,
						birthDate: sql`excluded.birth_date`,
						deathDate: sql`excluded.death_date`,
						profession: sql`excluded.profession`,
						photoUrl: sql`excluded.photo_url`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[AN] Error inserting députés:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 500 === 0) {
			logProgress(stats, 'Députés AN');
		}
	}

	logProgress(stats, 'Députés AN');
	return stats;
}

/**
 * Importe les mandats (députés + affiliations groupe) depuis les données AN
 */
export async function importMandatsFromAN(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	await downloadAndExtractData();

	console.log('[AN] Loading acteurs for mandates...');
	const allActeurs = await loadActeurs();
	const deputes = filterDeputes(allActeurs);

	// Collect all mandates
	const allMandates: ReturnType<typeof mapActeurMandats> = [];
	for (const depute of deputes) {
		try {
			const deputeMandats = mapActeurMandats(depute);
			allMandates.push(...deputeMandats);
		} catch (error) {
			const uid = typeof depute.acteur.uid === 'object'
				? depute.acteur.uid['#text']
				: depute.acteur.uid;
			console.error(`[AN] Error mapping mandates for ${uid}:`, error);
		}
	}

	console.log(`[AN] Found ${allMandates.length} mandats to import`);
	stats.total = allMandates.length;

	const batchSize = config.batchSize;
	for (let i = 0; i < allMandates.length; i += batchSize) {
		const batch = allMandates.slice(i, i + batchSize);

		try {
			await db
				.insert(mandates)
				.values(batch)
				.onConflictDoUpdate({
					target: mandates.id,
					set: {
						endDate: sql`excluded.end_date`,
						quality: sql`excluded.quality`,
						mandateEndCause: sql`excluded.mandate_end_cause`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[AN] Error inserting mandates batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 1000 === 0) {
			logProgress(stats, 'Mandats AN');
		}
	}

	logProgress(stats, 'Mandats AN');
	return stats;
}

/**
 * Statistiques sur les données AN
 */
export async function getANStats(): Promise<{
	totalActeurs: number;
	totalDeputes: number;
	totalGroupes: number;
	legislatures: Map<string, number>;
}> {
	await downloadAndExtractData();

	const allActeurs = await loadActeurs();
	const deputes = filterDeputes(allActeurs);
	const organes = await loadOrganes();
	const groupes = organes.filter((o) => o.organe.codeType === 'GP');

	// Count deputies per legislature
	const legislatures = new Map<string, number>();
	for (const depute of deputes) {
		const legs = getActeurLegislatures(depute);
		for (const leg of legs) {
			legislatures.set(leg, (legislatures.get(leg) || 0) + 1);
		}
	}

	return {
		totalActeurs: allActeurs.length,
		totalDeputes: deputes.length,
		totalGroupes: groupes.length,
		legislatures
	};
}
