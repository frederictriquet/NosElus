import 'dotenv/config';
import { importSenatLaws } from '../../src/lib/server/etl/sources/senat/laws.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';
import { updateSyncMetadata } from '../../src/lib/server/etl/utils.js';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const SOURCE = 'senat';

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import Dossiers Législatifs Sénat');
	console.log('='.repeat(60));

	const config = getETLConfig();

	console.log(`Configuration:`);
	console.log(`  Batch size: ${config.batchSize}`);
	console.log('');

	try {
		const stats = await importSenatLaws(config);

		// Update sync metadata (ignore errors if table doesn't exist)
		try {
			await updateSyncMetadata(SOURCE, 'laws', stats, {
				status: stats.errors > 0 ? 'partial' : 'success'
			});
		} catch (syncError) {
			console.warn('[Warning] Could not update sync_metadata:', (syncError as Error).message);
		}

		console.log('\n' + '='.repeat(60));
		console.log('Import completed successfully!');
		console.log(`  Total: ${stats.total}`);
		console.log(`  Inserted: ${stats.inserted}`);
		console.log(`  Errors: ${stats.errors}`);
		console.log('='.repeat(60));

		await notifyETLComplete('import-senat-laws', stats, {
			dryRun: process.argv.includes('--dry-run')
		});
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
