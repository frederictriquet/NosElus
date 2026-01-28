import { importScrutins, importVotes } from '../../src/lib/server/etl/sources/assemblee/scrutins.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import Scrutins');
	console.log('='.repeat(60));

	const config = getETLConfig();
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
		// Import scrutins first
		console.log('\n--- Importing Scrutins ---');
		const scrutinsStats = await importScrutins(config);
		console.log(`Scrutins: ${scrutinsStats.inserted} imported, ${scrutinsStats.errors} errors`);

		// Import votes
		console.log('\n--- Importing Votes ---');
		const votesStats = await importVotes(config);
		console.log(`Votes: ${votesStats.inserted} imported, ${votesStats.errors} errors`);

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
