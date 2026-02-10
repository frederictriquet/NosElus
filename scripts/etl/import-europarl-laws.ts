/**
 * Import European Parliament laws/procedures from HowTheyVote.eu
 *
 * Source: HowTheyVote.eu API
 * Data: Legislative procedures extracted from main votes
 *
 * Usage: npx tsx scripts/etl/import-europarl-laws.ts [--incremental]
 */

import 'dotenv/config';
import { importEuroparlLaws } from '../../src/lib/server/etl/sources/europarl/laws';
import type { ETLConfig } from '../../src/lib/server/etl/types';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

async function main() {
	const incremental = process.argv.includes('--incremental');
	const dryRun = process.argv.includes('--dry-run');

	console.log('='.repeat(60));
	console.log('NosElus ETL - Import des lois/procédures du Parlement Européen');
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
		const stats = await importEuroparlLaws(config);

		console.log('');
		console.log('='.repeat(60));
		console.log('RÉSUMÉ');
		console.log('='.repeat(60));
		console.log(`  Lois/procédures traitées: ${stats.total}`);
		console.log(`  Insérées/MàJ: ${stats.inserted}`);
		console.log(`  Erreurs: ${stats.errors}`);
		console.log('='.repeat(60));

		// Notification Telegram
		await notifyETLComplete('import-europarl-laws', stats, { dryRun });
	} catch (error) {
		console.error('Erreur fatale:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
