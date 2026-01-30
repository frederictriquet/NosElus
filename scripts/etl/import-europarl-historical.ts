import { importEuroparlHistoricalMeps } from '../../src/lib/server/etl/sources/europarl/meps.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';
import { updateSyncMetadata } from '../../src/lib/server/etl/utils.js';

const SOURCE = 'europarl';

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import Historique Eurodéputés français');
	console.log('Source: ParlTrack (depuis 2004, terme 6)');
	console.log('='.repeat(60));

	const config = getETLConfig();

	console.log(`Configuration:`);
	console.log(`  Batch size: ${config.batchSize}`);
	console.log('');

	try {
		const stats = await importEuroparlHistoricalMeps(config);

		// Update sync metadata
		try {
			await updateSyncMetadata(SOURCE, 'historical_meps', stats, {
				legislatures: '6,7,8,9,10',
				status: stats.errors > 0 ? 'partial' : 'success'
			});
		} catch (syncError) {
			console.warn('[Warning] Could not update sync_metadata:', (syncError as Error).message);
		}

		console.log('\n' + '='.repeat(60));
		console.log('RÉSUMÉ');
		console.log('='.repeat(60));
		console.log(`  MEPs importés: ${stats.inserted}`);
		console.log(`  Erreurs: ${stats.errors}`);
		console.log('='.repeat(60));
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
