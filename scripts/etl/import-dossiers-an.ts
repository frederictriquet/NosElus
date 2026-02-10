/**
 * Script ETL : Import des dossiers législatifs AN
 */

import 'dotenv/config';
import { importDossiersAN } from '../../src/lib/server/etl/import-dossiers-an';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const dataDir = process.env.ETL_DATA_DIR || './data/assemblee/dossiers_legislatifs';
const legislature = process.env.ETL_LEGISLATURE || '17';

console.log('='.repeat(60));
console.log('NosElus ETL - Import Dossiers Législatifs AN');
console.log('='.repeat(60));
console.log(`Legislature: ${legislature}`);
console.log(`Data dir: ${dataDir}`);
console.log('');

importDossiersAN(dataDir, legislature)
	.then(async (stats) => {
		console.log('');
		console.log('='.repeat(60));
		console.log('Summary:');
		console.log(`  Dossiers: ${stats.dossiersCreated}`);
		console.log(`  Cosignatories: ${stats.cosignatoriesCreated}`);
		console.log('='.repeat(60));

		await notifyETLComplete(
			'import-dossiers-an',
			{
				total: stats.dossiersCreated + stats.cosignatoriesCreated,
				inserted: stats.dossiersCreated + stats.cosignatoriesCreated,
				updated: 0,
				skipped: 0,
				errors: 0
			},
			{ legislature, dryRun: process.argv.includes('--dry-run') }
		);

		process.exit(0);
	})
	.catch((error) => {
		console.error('Error:', error);
		process.exit(1);
	});
