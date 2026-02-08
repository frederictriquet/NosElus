/**
 * Import European Parliament votes from HowTheyVote.eu
 *
 * Source: HowTheyVote.eu API
 * Data: Plenary votes with French MEP positions
 *
 * Usage: npx tsx scripts/etl/import-europarl-votes.ts [--incremental]
 */

import { importEuroparlVotes } from '../../src/lib/server/etl/sources/europarl/votes';
import type { ETLConfig } from '../../src/lib/server/etl/types';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

async function main() {
	const incremental = process.argv.includes('--incremental');

	console.log('='.repeat(60));
	console.log('NosElus ETL - Import des votes du Parlement Européen');
	console.log('Source: HowTheyVote.eu');
	console.log('='.repeat(60));
	console.log('');

	const config: ETLConfig = {
		batchSize: 50,
		incremental
	};

	if (incremental) {
		console.log('Mode: Incrémental (5 dernières pages)');
	} else {
		console.log('Mode: Complet (50 pages max)');
	}
	console.log('');

	try {
		const stats = await importEuroparlVotes(config);

		console.log('');
		console.log('='.repeat(60));
		console.log('RÉSUMÉ');
		console.log('='.repeat(60));
		console.log(`  Votes traités: ${stats.total}`);
		console.log(`  Insérés/MàJ: ${stats.inserted}`);
		console.log(`  Erreurs: ${stats.errors}`);
		console.log('='.repeat(60));

		await notifyETLComplete('import-europarl-votes', stats, {
			dryRun: process.argv.includes('--dry-run')
		});
	} catch (error) {
		console.error('Erreur fatale:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
