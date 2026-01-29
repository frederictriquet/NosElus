import { importLaws, linkScrutinsToLaws } from '../../src/lib/server/etl/sources/assemblee/laws.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';
import { parseArgs, updateSyncMetadata } from '../../src/lib/server/etl/utils.js';

const SOURCE = 'assemblee';

async function main() {
	const args = parseArgs(process.argv.slice(2));

	console.log('='.repeat(60));
	console.log('NosElus ETL - Import Dossiers Législatifs');
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
	console.log('');

	if (!config.dataDir) {
		console.error('ERROR: ETL_DATA_DIR environment variable is required');
		console.error('');
		console.error('Please download the Assemblée nationale data first:');
		console.error('  1. Clone: git clone https://git.tricoteuses.fr/data/assemblee.git');
		console.error('  2. Set: export ETL_DATA_DIR=/path/to/assemblee');
		console.error('');
		process.exit(1);
	}

	try {
		// Import laws first
		console.log('\n--- Importing Dossiers Législatifs ---');
		const lawsStats = await importLaws(config);
		console.log(
			`Dossiers: ${lawsStats.inserted} imported, ${lawsStats.updated} updated, ${lawsStats.errors} errors`
		);

		// Update sync metadata for laws (ignore errors if table doesn't exist)
		try {
			await updateSyncMetadata(SOURCE, 'laws', lawsStats, {
				legislature: config.legislature,
				status: lawsStats.errors > 0 ? 'partial' : 'success'
			});
		} catch (syncError) {
			console.warn('[Warning] Could not update sync_metadata:', (syncError as Error).message);
		}

		// Link scrutins to laws
		console.log('\n--- Linking Scrutins to Laws ---');
		const linkStats = await linkScrutinsToLaws(config);
		console.log(
			`Links: ${linkStats.updated} scrutins linked, ${linkStats.skipped} not found, ${linkStats.errors} errors`
		);

		console.log('\n='.repeat(60));
		console.log('Import completed successfully!');
		console.log('='.repeat(60));
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
