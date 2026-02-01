import { enrichPEGroupNames } from '../../src/lib/server/etl/sources/europarl/enrich-group-names.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Enrich PE Group Names');
	console.log('Source: HowTheyVote.eu API');
	console.log('='.repeat(60));

	const config = getETLConfig();

	try {
		const stats = await enrichPEGroupNames(config);

		console.log('\n' + '='.repeat(60));
		console.log('Enrichment completed!');
		console.log(`  Total: ${stats.total}`);
		console.log(`  Updated: ${stats.updated}`);
		console.log(`  Skipped: ${stats.skipped}`);
		console.log(`  Errors: ${stats.errors}`);
		console.log('='.repeat(60));
	} catch (error) {
		console.error('Enrichment failed:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
