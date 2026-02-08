/**
 * Import activity statistics from NosDéputés.fr
 * Run with: npm run etl:nosdeputes-stats
 */

import { importNosDeputesActivityStats } from '../../src/lib/server/etl/sources/nosdeputes/activity-stats';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

async function main() {
	console.log('=== Import NosDéputés.fr Activity Statistics ===\n');

	const config = {
		dataDir: process.env.ETL_DATA_DIR || './data/assemblee',
		legislature: process.env.ETL_ASSEMBLEE_LEGISLATURE || '17',
		incremental: process.argv.includes('--incremental'),
		dryRun: process.argv.includes('--dry-run')
	};

	const stats = await importNosDeputesActivityStats(config);

	console.log('\n=== Import Summary ===');
	console.log(`Total: ${stats.total}`);
	console.log(`Inserted: ${stats.inserted}`);
	console.log(`Updated: ${stats.updated}`);
	console.log(`Skipped: ${stats.skipped}`);
	console.log(`Errors: ${stats.errors}`);

	await notifyETLComplete('import-nosdeputes-stats', stats, { dryRun: config.dryRun });

	process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
