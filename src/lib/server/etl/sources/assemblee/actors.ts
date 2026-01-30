import {
	iterLoadAssembleeActeurs,
	iterLoadAssembleeOrganes
} from '@tricoteuses/assemblee/loaders';
import type { Acteur, Organe } from '@tricoteuses/assemblee';
import type { Legislature } from '@tricoteuses/assemblee';
import { db, actors, organs, mandates } from '../../../db';
import { mapActeur, mapOrgane, mapMandat } from './mappers';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';

export async function importActors(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();
	const legislature = parseInt(config.legislature, 10) as Legislature;

	if (!config.dataDir) {
		throw new Error('ETL_DATA_DIR is required for importing actors from @tricoteuses/assemblee');
	}

	console.log(`[Actors] Starting import for legislature ${legislature}...`);
	console.log(`[Actors] Data directory: ${config.dataDir}`);

	const acteursList: Acteur[] = [];

	// Load actors from data directory
	for (const { acteur } of iterLoadAssembleeActeurs(config.dataDir, legislature)) {
		acteursList.push(acteur);
	}

	console.log(`[Actors] Found ${acteursList.length} actors`);
	stats.total = acteursList.length;

	// Process in batches
	const batchSize = config.batchSize;
	for (let i = 0; i < acteursList.length; i += batchSize) {
		const batch = acteursList.slice(i, i + batchSize);
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
			console.error(`[Actors] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 500 === 0 || i + batchSize >= acteursList.length) {
			logProgress(stats, 'Actors');
		}
	}

	return stats;
}

export async function importOrgans(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();
	const legislature = parseInt(config.legislature, 10) as Legislature;

	if (!config.dataDir) {
		throw new Error('ETL_DATA_DIR is required for importing organs from @tricoteuses/assemblee');
	}

	console.log(`[Organs] Starting import for legislature ${legislature}...`);

	const organesList: Organe[] = [];

	// Load organs from data directory
	for (const { organe } of iterLoadAssembleeOrganes(config.dataDir, legislature)) {
		organesList.push(organe);
	}

	console.log(`[Organs] Found ${organesList.length} organs`);
	stats.total = organesList.length;

	// First pass: insert all organs without parent references
	const mappedOrgans = organesList.map(mapOrgane);

	// Sort to insert parents first (organs without parentId)
	const sortedOrgans = [...mappedOrgans].sort((a, b) => {
		if (!a.parentId && b.parentId) return -1;
		if (a.parentId && !b.parentId) return 1;
		return 0;
	});

	const batchSize = config.batchSize;
	for (let i = 0; i < sortedOrgans.length; i += batchSize) {
		const batch = sortedOrgans.slice(i, i + batchSize);

		try {
			await db
				.insert(organs)
				.values(batch)
				.onConflictDoUpdate({
					target: organs.id,
					set: {
						name: sql`excluded.name`,
						shortName: sql`excluded.short_name`,
						color: sql`excluded.color`,
						startDate: sql`excluded.start_date`,
						endDate: sql`excluded.end_date`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[Organs] Error inserting batch:`, error);
			stats.errors += batch.length;
		}
	}

	logProgress(stats, 'Organs');
	return stats;
}

export async function importMandates(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();
	const legislature = parseInt(config.legislature, 10) as Legislature;

	if (!config.dataDir) {
		throw new Error('ETL_DATA_DIR is required for importing mandates from @tricoteuses/assemblee');
	}

	console.log(`[Mandates] Starting import for legislature ${legislature}...`);

	const mandatesList: Array<{ acteurUid: string; mandat: ReturnType<typeof mapMandat> }> = [];

	// Load actors and extract their mandates
	for (const { acteur } of iterLoadAssembleeActeurs(config.dataDir, legislature)) {
		if (acteur.mandats) {
			for (const mandat of acteur.mandats) {
				const mapped = mapMandat(mandat, acteur.uid);
				if (mapped) {
					mandatesList.push({ acteurUid: acteur.uid, mandat: mapped });
				}
			}
		}
	}

	console.log(`[Mandates] Found ${mandatesList.length} mandates`);
	stats.total = mandatesList.length;

	const batchSize = config.batchSize;
	for (let i = 0; i < mandatesList.length; i += batchSize) {
		const batch = mandatesList.slice(i, i + batchSize);
		const mandatesToInsert = batch.map((m) => m.mandat).filter((m) => m !== null);

		try {
			await db
				.insert(mandates)
				.values(mandatesToInsert)
				.onConflictDoUpdate({
					target: mandates.id,
					set: {
						type: sql`excluded.type`,
						quality: sql`excluded.quality`,
						startDate: sql`excluded.start_date`,
						endDate: sql`excluded.end_date`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += mandatesToInsert.length;
		} catch (error) {
			// Likely foreign key constraint - organ doesn't exist
			// Try inserting one by one
			for (const mandat of mandatesToInsert) {
				try {
					await db.insert(mandates).values(mandat).onConflictDoNothing();
					stats.inserted++;
				} catch {
					stats.errors++;
				}
			}
		}

		if ((i + batchSize) % 1000 === 0 || i + batchSize >= mandatesList.length) {
			logProgress(stats, 'Mandates');
		}
	}

	return stats;
}
