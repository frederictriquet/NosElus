/**
 * Script ETL : Lier les scrutins aux textes via parsing des titres
 */

import { linkScrutinsByTitle } from '../../src/lib/server/etl/link-scrutins-by-title';

const legislature = process.env.ETL_LEGISLATURE || '17';

console.log('='.repeat(60));
console.log('NosElus ETL - Link Scrutins to Laws (by title parsing)');
console.log('='.repeat(60));
console.log(`Legislature: ${legislature}`);
console.log('');

linkScrutinsByTitle(legislature)
	.then((stats) => {
		console.log('');
		console.log('='.repeat(60));
		console.log('Summary:');
		console.log(`  Texts created: ${stats.textsCreated}`);
		console.log(`  Scrutins linked: ${stats.scrutinsLinked}`);
		console.log('='.repeat(60));
		process.exit(0);
	})
	.catch((error) => {
		console.error('Error:', error);
		process.exit(1);
	});
