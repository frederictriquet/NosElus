/**
 * Script ETL : Lier les scrutins aux textes via parsing des titres
 */

import { linkScrutinsByTitle } from '../../src/lib/server/etl/link-scrutins-by-title';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const legislature = process.env.ETL_LEGISLATURE || '17';

console.log('='.repeat(60));
console.log('NosElus ETL - Link Scrutins to Laws (by title parsing)');
console.log('='.repeat(60));
console.log(`Legislature: ${legislature}`);
console.log('');

linkScrutinsByTitle(legislature)
	.then(async (stats) => {
		console.log('');
		console.log('='.repeat(60));
		console.log('Summary:');
		console.log(`  Texts created: ${stats.textsCreated}`);
		console.log(`  Scrutins linked: ${stats.scrutinsLinked}`);
		console.log('='.repeat(60));

		await notifyETLComplete(
			'link-scrutins-by-title',
			{
				total: stats.textsCreated + stats.scrutinsLinked,
				inserted: stats.textsCreated,
				updated: stats.scrutinsLinked,
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
