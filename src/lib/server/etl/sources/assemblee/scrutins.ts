import { iterLoadAssembleeScrutins } from '@tricoteuses/assemblee/loaders';
import type { Scrutin } from '@tricoteuses/assemblee';
import type { Legislature } from '@tricoteuses/assemblee';
import { db, scrutins, votes } from '../../../db';
import { mapScrutin, mapVotesFromScrutin } from './mappers';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';

export async function importScrutins(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();
	const legislature = parseInt(config.legislature, 10) as Legislature;

	if (!config.dataDir) {
		throw new Error('ETL_DATA_DIR is required for importing scrutins from @tricoteuses/assemblee');
	}

	console.log(`[Scrutins] Starting import for legislature ${legislature}...`);

	const scrutinsList: Scrutin[] = [];

	// Load scrutins from data directory
	for (const { scrutin } of iterLoadAssembleeScrutins(config.dataDir, legislature)) {
		scrutinsList.push(scrutin);
	}

	console.log(`[Scrutins] Found ${scrutinsList.length} scrutins`);
	stats.total = scrutinsList.length;

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
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[Scrutins] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 100 === 0 || i + batchSize >= scrutinsList.length) {
			logProgress(stats, 'Scrutins');
		}
	}

	return stats;
}

export async function importVotes(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();
	const legislature = parseInt(config.legislature, 10) as Legislature;

	if (!config.dataDir) {
		throw new Error('ETL_DATA_DIR is required for importing votes from @tricoteuses/assemblee');
	}

	console.log(`[Votes] Starting import for legislature ${legislature}...`);

	let totalVotes = 0;
	let processedScrutins = 0;

	// Process each scrutin and extract votes
	for (const { scrutin } of iterLoadAssembleeScrutins(config.dataDir, legislature)) {
		const scrutinVotes = mapVotesFromScrutin(scrutin);
		totalVotes += scrutinVotes.length;

		if (scrutinVotes.length > 0) {
			try {
				// Insert votes in batches
				const batchSize = config.batchSize;
				for (let i = 0; i < scrutinVotes.length; i += batchSize) {
					const batch = scrutinVotes.slice(i, i + batchSize);

					await db.insert(votes).values(batch).onConflictDoNothing();

					stats.inserted += batch.length;
				}
			} catch (error) {
				// Foreign key constraint errors - actor doesn't exist
				// Try inserting one by one
				for (const vote of scrutinVotes) {
					try {
						await db.insert(votes).values(vote).onConflictDoNothing();
						stats.inserted++;
					} catch {
						stats.errors++;
					}
				}
			}
		}

		processedScrutins++;
		if (processedScrutins % 50 === 0) {
			console.log(
				`[Votes] Processed ${processedScrutins} scrutins, ${stats.inserted} votes inserted`
			);
		}
	}

	stats.total = totalVotes;
	logProgress(stats, 'Votes');
	return stats;
}
