/**
 * Script ETL : Import des dossiers législatifs AN
 */

import { importDossiersAN } from '../../src/lib/server/etl/import-dossiers-an';

const dataDir = process.env.ETL_DATA_DIR || './data/assemblee/dossiers_legislatifs';
const legislature = process.env.ETL_LEGISLATURE || '17';

console.log('='.repeat(60));
console.log('NosElus ETL - Import Dossiers Législatifs AN');
console.log('='.repeat(60));
console.log(`Legislature: ${legislature}`);
console.log(`Data dir: ${dataDir}`);
console.log('');

importDossiersAN(dataDir, legislature)
	.then((stats) => {
		console.log('');
		console.log('='.repeat(60));
		console.log('Summary:');
		console.log(`  Dossiers: ${stats.dossiersCreated}`);
		console.log(`  Cosignatories: ${stats.cosignatoriesCreated}`);
		console.log('='.repeat(60));
		process.exit(0);
	})
	.catch((error) => {
		console.error('Error:', error);
		process.exit(1);
	});
