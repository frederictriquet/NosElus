import {
	importDeputesFromNosdeputes,
	importGroupesFromNosdeputes,
	importScrutinsFromNosdeputes,
	importVotesFromNosdeputes
} from '../../src/lib/server/etl/sources/nosdeputes/import.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import depuis NosDéputés.fr');
	console.log('='.repeat(60));

	const config = getETLConfig();
	console.log(`Configuration:`);
	console.log(`  Batch size: ${config.batchSize}`);
	console.log('');

	const startTime = Date.now();

	try {
		// Step 1: Import groupes parlementaires
		console.log('\n' + '='.repeat(40));
		console.log('Step 1/4: Importing Groupes Parlementaires');
		console.log('='.repeat(40));
		const groupesStats = await importGroupesFromNosdeputes(config);
		console.log(`✓ Groupes: ${groupesStats.inserted} imported, ${groupesStats.errors} errors`);

		// Step 2: Import députés
		console.log('\n' + '='.repeat(40));
		console.log('Step 2/4: Importing Députés');
		console.log('='.repeat(40));
		const deputesStats = await importDeputesFromNosdeputes(config);
		console.log(`✓ Députés: ${deputesStats.inserted} imported, ${deputesStats.errors} errors`);

		// Step 3: Import scrutins
		console.log('\n' + '='.repeat(40));
		console.log('Step 3/4: Importing Scrutins');
		console.log('='.repeat(40));
		const scrutinsStats = await importScrutinsFromNosdeputes(config);
		console.log(`✓ Scrutins: ${scrutinsStats.inserted} imported, ${scrutinsStats.errors} errors`);

		// Step 4: Import votes (limit to first 50 scrutins for initial import)
		console.log('\n' + '='.repeat(40));
		console.log('Step 4/4: Importing Votes (premiers 50 scrutins)');
		console.log('='.repeat(40));
		const votesStats = await importVotesFromNosdeputes(config, 50);
		console.log(`✓ Votes: ${votesStats.inserted} imported, ${votesStats.errors} errors`);

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);

		console.log('\n' + '='.repeat(60));
		console.log('IMPORT SUMMARY');
		console.log('='.repeat(60));
		console.log(`  Groupes:  ${groupesStats.inserted} (${groupesStats.errors} errors)`);
		console.log(`  Députés:  ${deputesStats.inserted} (${deputesStats.errors} errors)`);
		console.log(`  Scrutins: ${scrutinsStats.inserted} (${scrutinsStats.errors} errors)`);
		console.log(`  Votes:    ${votesStats.inserted} (${votesStats.errors} errors)`);
		console.log('');
		console.log(`Total time: ${duration}s`);
		console.log('='.repeat(60));

		const combinedStats = {
			total: groupesStats.total + deputesStats.total + scrutinsStats.total + votesStats.total,
			inserted:
				groupesStats.inserted +
				deputesStats.inserted +
				scrutinsStats.inserted +
				votesStats.inserted,
			updated:
				groupesStats.updated + deputesStats.updated + scrutinsStats.updated + votesStats.updated,
			skipped:
				groupesStats.skipped + deputesStats.skipped + scrutinsStats.skipped + votesStats.skipped,
			errors: groupesStats.errors + deputesStats.errors + scrutinsStats.errors + votesStats.errors
		};
		await notifyETLComplete('import-nosdeputes', combinedStats, {
			dryRun: process.argv.includes('--dry-run'),
			additionalInfo: {
				groupes: groupesStats.inserted,
				deputes: deputesStats.inserted,
				scrutins: scrutinsStats.inserted,
				votes: votesStats.inserted
			}
		});
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
