import { importActors, importOrgans, importMandates } from '../../src/lib/server/etl/sources/assemblee/actors.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import Actors');
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
		// Import organs first (needed for mandates foreign keys)
		console.log('\n--- Importing Organs ---');
		const organsStats = await importOrgans(config);
		console.log(`Organs: ${organsStats.inserted} imported, ${organsStats.errors} errors`);

		// Import actors
		console.log('\n--- Importing Actors ---');
		const actorsStats = await importActors(config);
		console.log(`Actors: ${actorsStats.inserted} imported, ${actorsStats.errors} errors`);

		// Import mandates
		console.log('\n--- Importing Mandates ---');
		const mandatesStats = await importMandates(config);
		console.log(`Mandates: ${mandatesStats.inserted} imported, ${mandatesStats.errors} errors`);

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
