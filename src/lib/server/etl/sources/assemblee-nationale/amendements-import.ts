/**
 * Import des amendements de l'Assemblée Nationale dans la base de données
 */

import { db, amendments } from '../../../db';
import { loadAmendements, getAvailableAmendementsLegislatures } from './amendements-loader';
import { mapAmendement } from './amendements-mappers';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';

/**
 * Importe les amendements pour une législature donnée
 */
export async function importAmendementsFromAN(
	config: ETLConfig,
	legislature?: string
): Promise<ImportStats> {
	const stats = createImportStats();
	const targetLegislatures = legislature ? [legislature] : getAvailableAmendementsLegislatures();

	console.log(
		`[AN Amendements] Starting import for legislatures: ${targetLegislatures.join(', ')}`
	);

	for (const leg of targetLegislatures) {
		console.log(`\n[AN Amendements] Processing legislature ${leg}...`);

		const rawAmendements = await loadAmendements(leg);
		console.log(
			`[AN Amendements] Loaded ${rawAmendements.length} amendements for legislature ${leg}`
		);

		stats.total += rawAmendements.length;

		// Map all amendments
		const mappedAmendements = rawAmendements.map(mapAmendement);

		// Filter out amendments without valid IDs
		const validAmendements = mappedAmendements.filter((a) => a.id && a.number);
		const skipped = mappedAmendements.length - validAmendements.length;
		stats.skipped += skipped;

		if (skipped > 0) {
			console.log(`[AN Amendements] Skipped ${skipped} amendements with missing required fields`);
		}

		// Insert in batches
		const batchSize = config.batchSize;
		let inserted = 0;
		let errors = 0;

		for (let i = 0; i < validAmendements.length; i += batchSize) {
			const batch = validAmendements.slice(i, i + batchSize);

			try {
				await db
					.insert(amendments)
					.values(batch)
					.onConflictDoUpdate({
						target: amendments.id,
						set: {
							status: sql`excluded.status`,
							dispositif: sql`excluded.dispositif`,
							exposeSommaire: sql`excluded.expose_sommaire`,
							examDate: sql`excluded.exam_date`,
							updatedAt: sql`now()`
						}
					});

				inserted += batch.length;
			} catch (error) {
				console.error(`[AN Amendements] Error inserting batch at index ${i}:`, error);
				errors += batch.length;
			}

			// Log progress every 1000 amendments
			if ((i + batchSize) % 1000 === 0 || i + batchSize >= validAmendements.length) {
				console.log(
					`[AN Amendements] Legislature ${leg}: ${Math.min(i + batchSize, validAmendements.length)}/${validAmendements.length} processed`
				);
			}
		}

		stats.inserted += inserted;
		stats.errors += errors;

		console.log(
			`[AN Amendements] Legislature ${leg} complete: ${inserted} inserted, ${errors} errors`
		);
	}

	logProgress(stats, 'Amendements');
	return stats;
}

/**
 * Importe tous les amendements de toutes les législatures disponibles
 */
export async function importAllAmendementsFromAN(config: ETLConfig): Promise<ImportStats> {
	return importAmendementsFromAN(config);
}
