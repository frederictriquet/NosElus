import { loadScrutins as loadANScrutins } from '../assemblee-nationale/scrutins-loader';
import { mapScrutin, extractVotes } from '../assemblee-nationale/scrutins-mappers';
import { db, scrutins, votes } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';

export async function importScrutins(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log(`[Scrutins] Starting import for legislature ${config.legislature}...`);

	const scrutinsList = await loadANScrutins(config.legislature);

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

	console.log(`[Votes] Starting import for legislature ${config.legislature}...`);

	const scrutinsList = await loadANScrutins(config.legislature);

	let totalVotes = 0;
	let processedScrutins = 0;

	for (const scrutin of scrutinsList) {
		const scrutinVotes = extractVotes(scrutin);
		totalVotes += scrutinVotes.length;

		if (scrutinVotes.length > 0) {
			try {
				const batchSize = config.batchSize;
				for (let i = 0; i < scrutinVotes.length; i += batchSize) {
					const batch = scrutinVotes.slice(i, i + batchSize);
					await db.insert(votes).values(batch).onConflictDoNothing();
					stats.inserted += batch.length;
				}
			} catch {
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
