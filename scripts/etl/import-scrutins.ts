import 'dotenv/config';
import {
	importScrutins,
	importVotes
} from '../../src/lib/server/etl/sources/assemblee/scrutins.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';
import { parseArgs, getLastSync, updateSyncMetadata } from '../../src/lib/server/etl/utils.js';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const SOURCE = 'assemblee';

async function main() {
	const args = parseArgs(process.argv.slice(2));

	console.log('='.repeat(60));
	console.log('NosElus ETL - Import Scrutins');
	console.log('='.repeat(60));

	const baseConfig = getETLConfig();
	const config = {
		...baseConfig,
		legislature: args.legislature || baseConfig.legislature,
		incremental: args.incremental,
		since: args.since
	};

	console.log(`Configuration:`);
	console.log(`  Legislature: ${config.legislature}`);
	console.log(`  Batch size: ${config.batchSize}`);
	console.log(`  Data dir: ${config.dataDir || 'NOT SET'}`);
	console.log(`  Mode: ${config.incremental ? 'INCREMENTAL' : 'FULL'}`);

	if (config.incremental) {
		const lastSync = await getLastSync(SOURCE, 'scrutins', config.legislature);
		if (lastSync) {
			console.log(`  Last sync: ${lastSync.lastSyncAt.toISOString()}`);
			config.since = config.since || lastSync.lastSyncAt;
		} else {
			console.log(`  Last sync: Never (first incremental will be full)`);
		}
	}
	console.log('');

	try {
		// Import scrutins first
		console.log('\n--- Importing Scrutins ---');
		const scrutinsStats = await importScrutins(config);
		console.log(
			`Scrutins: ${scrutinsStats.inserted} imported, ${scrutinsStats.updated} updated, ${scrutinsStats.errors} errors`
		);

		// Update sync metadata for scrutins (ignore errors if table doesn't exist)
		try {
			await updateSyncMetadata(SOURCE, 'scrutins', scrutinsStats, {
				legislature: config.legislature,
				status: scrutinsStats.errors > 0 ? 'partial' : 'success'
			});
		} catch (syncError) {
			console.warn('[Warning] Could not update sync_metadata for scrutins');
		}

		// Import votes
		console.log('\n--- Importing Votes ---');
		const votesStats = await importVotes(config);
		console.log(
			`Votes: ${votesStats.inserted} imported, ${votesStats.updated} updated, ${votesStats.errors} errors`
		);

		// Update sync metadata for votes (ignore errors if table doesn't exist)
		try {
			await updateSyncMetadata(SOURCE, 'votes', votesStats, {
				legislature: config.legislature,
				status: votesStats.errors > 0 ? 'partial' : 'success'
			});
		} catch (syncError) {
			console.warn('[Warning] Could not update sync_metadata for votes');
		}

		console.log('\n='.repeat(60));
		console.log('Import completed successfully!');
		console.log('='.repeat(60));

		const combinedStats = {
			total: scrutinsStats.total + votesStats.total,
			inserted: scrutinsStats.inserted + votesStats.inserted,
			updated: scrutinsStats.updated + votesStats.updated,
			skipped: scrutinsStats.skipped + votesStats.skipped,
			errors: scrutinsStats.errors + votesStats.errors
		};
		await notifyETLComplete('import-scrutins', combinedStats, {
			dryRun: process.argv.includes('--dry-run'),
			legislature: config.legislature,
			additionalInfo: { scrutins: scrutinsStats.inserted, votes: votesStats.inserted }
		});
	} catch (error) {
		console.error('Import failed:', error);

		// Log failed sync (ignore errors if table doesn't exist)
		try {
			await updateSyncMetadata(
				SOURCE,
				'scrutins',
				{ total: 0, inserted: 0, updated: 0, skipped: 0, errors: 1 },
				{ legislature: config.legislature, status: 'failed' }
			);
		} catch {
			// Ignore
		}

		process.exit(1);
	}

	process.exit(0);
}

main();
