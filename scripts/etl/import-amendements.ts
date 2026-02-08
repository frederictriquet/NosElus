/**
 * Import des amendements depuis l'Assemblée Nationale
 *
 * Usage:
 *   npx tsx scripts/etl/import-amendements.ts           # Toutes les législatures
 *   npx tsx scripts/etl/import-amendements.ts 17        # Législature 17 uniquement
 */

import { importAmendementsFromAN } from '../../src/lib/server/etl/sources/assemblee-nationale/amendements-import.js';
import { getAvailableAmendementsLegislatures } from '../../src/lib/server/etl/sources/assemblee-nationale/amendements-loader.js';
import { getETLConfig } from '../../src/lib/server/etl/types.js';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

async function main() {
	const legislature = process.argv[2];

	console.log('='.repeat(60));
	console.log('NosElus ETL - Import des amendements (Assemblée Nationale)');
	console.log('='.repeat(60));
	console.log('');

	const availableLegislatures = getAvailableAmendementsLegislatures();
	console.log(`Législatures disponibles: ${availableLegislatures.join(', ')}`);

	if (legislature && !availableLegislatures.includes(legislature)) {
		console.error(`Erreur: Législature ${legislature} non disponible`);
		process.exit(1);
	}

	const config = getETLConfig();
	console.log(`Configuration:`);
	console.log(`  Batch size: ${config.batchSize}`);
	console.log(`  Législature(s): ${legislature || 'toutes'}`);
	console.log('');

	const startTime = Date.now();

	try {
		const stats = await importAmendementsFromAN(config, legislature);

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);

		console.log('\n' + '='.repeat(60));
		console.log('RÉSUMÉ');
		console.log('='.repeat(60));
		console.log(`  Total traités: ${stats.total}`);
		console.log(`  Importés: ${stats.inserted}`);
		console.log(`  Ignorés: ${stats.skipped}`);
		console.log(`  Erreurs: ${stats.errors}`);
		console.log('');
		console.log(`Durée: ${duration}s`);
		console.log('='.repeat(60));

		await notifyETLComplete('import-amendements', stats, {
			dryRun: process.argv.includes('--dry-run'),
			legislature: legislature || 'toutes'
		});

		process.exit(stats.errors > 0 ? 1 : 0);
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}
}

main();
