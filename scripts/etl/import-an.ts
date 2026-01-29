/**
 * Script d'import des données historiques de l'Assemblée Nationale
 * Source: data.assemblee-nationale.fr
 *
 * Usage: npx tsx scripts/etl/import-an.ts [--stats-only] [--groupes] [--deputes] [--mandats] [--all]
 */

import {
	importOrganesFromAN,
	importDeputesFromAN,
	importMandatsFromAN,
	getANStats
} from '../../src/lib/server/etl/sources/assemblee-nationale';
import type { ETLConfig } from '../../src/lib/server/etl/types';

const config: ETLConfig = {
	legislature: '17', // Législature actuelle pour référence
	batchSize: 100
};

async function main() {
	const args = process.argv.slice(2);

	const statsOnly = args.includes('--stats-only');
	const importOrganes = args.includes('--organes') || args.includes('--all');
	const importDeputes = args.includes('--deputes') || args.includes('--all');
	const importMandats = args.includes('--mandats') || args.includes('--all');

	// If no specific flag, show stats
	if (args.length === 0 || statsOnly) {
		console.log('=== Statistiques données AN ===\n');
		const stats = await getANStats();
		console.log(`Total acteurs: ${stats.totalActeurs}`);
		console.log(`Total députés: ${stats.totalDeputes}`);
		console.log(`Total groupes parlementaires: ${stats.totalGroupes}`);
		console.log('\nDéputés par législature:');
		const sortedLegs = Array.from(stats.legislatures.entries()).sort((a, b) =>
			parseInt(a[0]) - parseInt(b[0])
		);
		for (const [leg, count] of sortedLegs) {
			console.log(`  Législature ${leg}: ${count} députés`);
		}

		if (statsOnly) {
			process.exit(0);
		}

		console.log('\nPour importer les données, utilisez:');
		console.log('  --organes  : Importer les organes (ASSEMBLEE + GP)');
		console.log('  --deputes  : Importer les députés');
		console.log('  --mandats  : Importer les mandats');
		console.log('  --all      : Tout importer');
		process.exit(0);
	}

	console.log('=== Import données Assemblée Nationale ===\n');

	// Import organes first (needed for mandates FK)
	if (importOrganes) {
		console.log('\n--- Organes (ASSEMBLEE + GP) ---');
		const organesStats = await importOrganesFromAN(config);
		console.log(`Organes: ${organesStats.inserted} importés, ${organesStats.errors} erreurs`);
	}

	// Import députés
	if (importDeputes) {
		console.log('\n--- Députés ---');
		const deputesStats = await importDeputesFromAN(config);
		console.log(`Députés: ${deputesStats.inserted} importés, ${deputesStats.errors} erreurs`);
	}

	// Import mandats
	if (importMandats) {
		console.log('\n--- Mandats ---');
		const mandatsStats = await importMandatsFromAN(config);
		console.log(`Mandats: ${mandatsStats.inserted} importés, ${mandatsStats.errors} erreurs`);
	}

	console.log('\n=== Import terminé ===');
	process.exit(0);
}

main().catch((error) => {
	console.error('Erreur:', error);
	process.exit(1);
});
