import { importActors, importOrgans, importMandates } from '../../src/lib/server/etl/sources/assemblee/actors.js';
import { importScrutins, importVotes } from '../../src/lib/server/etl/sources/assemblee/scrutins.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Full Import');
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

	const startTime = Date.now();

	try {
		// Step 1: Import organs (needed for foreign keys)
		console.log('\n' + '='.repeat(40));
		console.log('Step 1/5: Importing Organs');
		console.log('='.repeat(40));
		const organsStats = await importOrgans(config);
		console.log(`✓ Organs: ${organsStats.inserted} imported, ${organsStats.errors} errors`);

		// Step 2: Import actors
		console.log('\n' + '='.repeat(40));
		console.log('Step 2/5: Importing Actors');
		console.log('='.repeat(40));
		const actorsStats = await importActors(config);
		console.log(`✓ Actors: ${actorsStats.inserted} imported, ${actorsStats.errors} errors`);

		// Step 3: Import mandates
		console.log('\n' + '='.repeat(40));
		console.log('Step 3/5: Importing Mandates');
		console.log('='.repeat(40));
		const mandatesStats = await importMandates(config);
		console.log(`✓ Mandates: ${mandatesStats.inserted} imported, ${mandatesStats.errors} errors`);

		// Step 4: Import scrutins
		console.log('\n' + '='.repeat(40));
		console.log('Step 4/5: Importing Scrutins');
		console.log('='.repeat(40));
		const scrutinsStats = await importScrutins(config);
		console.log(`✓ Scrutins: ${scrutinsStats.inserted} imported, ${scrutinsStats.errors} errors`);

		// Step 5: Import votes
		console.log('\n' + '='.repeat(40));
		console.log('Step 5/5: Importing Votes');
		console.log('='.repeat(40));
		const votesStats = await importVotes(config);
		console.log(`✓ Votes: ${votesStats.inserted} imported, ${votesStats.errors} errors`);

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);

		console.log('\n' + '='.repeat(60));
		console.log('IMPORT SUMMARY');
		console.log('='.repeat(60));
		console.log(`  Organs:   ${organsStats.inserted} (${organsStats.errors} errors)`);
		console.log(`  Actors:   ${actorsStats.inserted} (${actorsStats.errors} errors)`);
		console.log(`  Mandates: ${mandatesStats.inserted} (${mandatesStats.errors} errors)`);
		console.log(`  Scrutins: ${scrutinsStats.inserted} (${scrutinsStats.errors} errors)`);
		console.log(`  Votes:    ${votesStats.inserted} (${votesStats.errors} errors)`);
		console.log('');
		console.log(`Total time: ${duration}s`);
		console.log('='.repeat(60));
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
