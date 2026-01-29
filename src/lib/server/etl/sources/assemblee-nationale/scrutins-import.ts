import { db, scrutins, votes } from '../../../db';
import { downloadScrutins, loadScrutins, getAvailableLegislatures } from './scrutins-loader';
import { mapScrutin, extractVotes } from './scrutins-mappers';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';

/**
 * Importe les scrutins depuis les données AN pour une législature
 */
export async function importScrutinsFromAN(
	config: ETLConfig,
	legislature?: string
): Promise<ImportStats> {
	const stats = createImportStats();

	const legislatures = legislature ? [legislature] : getAvailableLegislatures();

	for (const leg of legislatures) {
		console.log(`\n[AN Scrutins] Processing legislature ${leg}...`);
		await downloadScrutins(leg);
		const scrutinsList = await loadScrutins(leg);

		stats.total += scrutinsList.length;

		const batchSize = config.batchSize;
		for (let i = 0; i < scrutinsList.length; i += batchSize) {
			const batch = scrutinsList.slice(i, i + batchSize);
			const mappedScrutins = batch.map(mapScrutin);

			try {
				await db
					.insert(scrutins)
					.values(mappedScrutins)
					.onConflictDoUpdate({
						target: scrutins.id,
						set: {
							title: sql`excluded.title`,
							totalVoters: sql`excluded.total_voters`,
							totalFor: sql`excluded.total_for`,
							totalAgainst: sql`excluded.total_against`,
							totalAbstention: sql`excluded.total_abstention`,
							totalNonVoting: sql`excluded.total_non_voting`,
							result: sql`excluded.result`,
							groupResults: sql`excluded.group_results`,
							description: sql`excluded.description`,
							updatedAt: sql`now()`
						}
					});

				stats.inserted += batch.length;
			} catch (error) {
				console.error(`[AN Scrutins] Error inserting scrutins:`, error);
				stats.errors += batch.length;
			}

			if ((i + batchSize) % 500 === 0) {
				logProgress(stats, `Scrutins AN (L${leg})`);
			}
		}
	}

	logProgress(stats, 'Scrutins AN');
	return stats;
}

/**
 * Importe les votes nominatifs depuis les données AN pour une législature
 */
export async function importVotesFromAN(
	config: ETLConfig,
	legislature?: string
): Promise<ImportStats> {
	const stats = createImportStats();

	const legislatures = legislature ? [legislature] : getAvailableLegislatures();

	for (const leg of legislatures) {
		console.log(`\n[AN Votes] Processing legislature ${leg}...`);
		await downloadScrutins(leg);
		const scrutinsList = await loadScrutins(leg);

		let processedScrutins = 0;

		for (const scrutin of scrutinsList) {
			try {
				const scrutinVotes = extractVotes(scrutin);
				stats.total += scrutinVotes.length;

				if (scrutinVotes.length > 0) {
					// Insert in batches
					for (let i = 0; i < scrutinVotes.length; i += config.batchSize) {
						const batch = scrutinVotes.slice(i, i + config.batchSize);
						await db.insert(votes).values(batch).onConflictDoNothing();
						stats.inserted += batch.length;
					}
				}
			} catch (error) {
				console.error(
					`[AN Votes] Error processing scrutin ${scrutin.scrutin.uid}:`,
					error
				);
				stats.errors++;
			}

			processedScrutins++;
			if (processedScrutins % 100 === 0) {
				console.log(
					`[AN Votes] Processed ${processedScrutins}/${scrutinsList.length} scrutins (L${leg})`
				);
			}
		}
	}

	logProgress(stats, 'Votes AN');
	return stats;
}

/**
 * Statistiques sur les scrutins AN disponibles
 */
export async function getScrutinsStats(): Promise<{
	byLegislature: Record<string, number>;
	total: number;
}> {
	const byLegislature: Record<string, number> = {};
	let total = 0;

	for (const leg of getAvailableLegislatures()) {
		await downloadScrutins(leg);
		const scrutinsList = await loadScrutins(leg);
		byLegislature[leg] = scrutinsList.length;
		total += scrutinsList.length;
	}

	return { byLegislature, total };
}
