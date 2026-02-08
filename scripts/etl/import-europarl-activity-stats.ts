import { importEuroparlActivityStats } from '../../src/lib/server/etl/sources/europarl/activity-stats.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';
import { updateSyncMetadata } from '../../src/lib/server/etl/utils.js';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const SOURCE = 'europarl';

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import Europarl Activity Stats');
	console.log('Source: HowTheyVote.eu API');
	console.log('='.repeat(60));

	const config = getETLConfig();

	console.log(`Configuration:`);
	console.log(`  Batch size: ${config.batchSize}`);
	console.log('');

	try {
		const stats = await importEuroparlActivityStats(config);

		// Update sync metadata (ignore errors if table doesn't exist)
		try {
			await updateSyncMetadata(SOURCE, 'activity-stats', stats, {
				status: stats.errors > 0 ? 'partial' : 'success'
			});
		} catch (syncError) {
			console.warn('[Warning] Could not update sync_metadata:', (syncError as Error).message);
		}

		console.log('\n' + '='.repeat(60));
		console.log('Import completed successfully!');
		console.log(`  Total: ${stats.total}`);
		console.log(`  Inserted: ${stats.inserted}`);
		console.log(`  Skipped: ${stats.skipped}`);
		console.log(`  Errors: ${stats.errors}`);
		console.log('='.repeat(60));

		await notifyETLComplete('import-europarl-activity-stats', stats);
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
