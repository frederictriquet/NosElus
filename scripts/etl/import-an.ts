/**
 * Script d'import des données historiques de l'Assemblée Nationale
 * Source: data.assemblee-nationale.fr
 *
 * Usage: npx tsx scripts/etl/import-an.ts [options]
 *
 * Options:
 *   --stats-only  : Afficher les statistiques sans importer
 *   --organes     : Importer les organes (ASSEMBLEE + GP)
 *   --deputes     : Importer les députés
 *   --mandats     : Importer les mandats
 *   --scrutins    : Importer les scrutins
 *   --votes       : Importer les votes nominatifs
 *   --all         : Tout importer
 *   --leg=N       : Filtrer par législature (ex: --leg=17)
 */

import {
	importOrganesFromAN,
	importDeputesFromAN,
	importMandatsFromAN,
	getANStats,
	importScrutinsFromAN,
	importVotesFromAN,
	getScrutinsStats
} from '../../src/lib/server/etl/sources/assemblee-nationale';
import type { ETLConfig } from '../../src/lib/server/etl/types';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const config: ETLConfig = {
	legislature: '17',
	batchSize: 100
};

async function main() {
	const args = process.argv.slice(2);

	const statsOnly = args.includes('--stats-only');
	const importOrganes = args.includes('--organes') || args.includes('--all');
	const importDeputes = args.includes('--deputes') || args.includes('--all');
	const importMandats = args.includes('--mandats') || args.includes('--all');
	const importScrutins = args.includes('--scrutins') || args.includes('--all');
	const importVotes = args.includes('--votes') || args.includes('--all');

	// Parse legislature filter
	const legArg = args.find((a) => a.startsWith('--leg='));
	const legislature = legArg ? legArg.split('=')[1] : undefined;

	// If no specific flag, show stats
	if (args.length === 0 || statsOnly) {
		console.log('=== Statistiques données AN ===\n');

		// Actor stats
		const actorStats = await getANStats();
		console.log(`Total acteurs: ${actorStats.totalActeurs}`);
		console.log(`Total députés: ${actorStats.totalDeputes}`);
		console.log(`Total groupes parlementaires: ${actorStats.totalGroupes}`);
		console.log('\nDéputés par législature:');
		const sortedLegs = Array.from(actorStats.legislatures.entries()).sort(
			(a, b) => parseInt(a[0]) - parseInt(b[0])
		);
		for (const [leg, count] of sortedLegs) {
			console.log(`  Législature ${leg}: ${count} députés`);
		}

		// Scrutins stats
		console.log('\n--- Scrutins ---');
		const scrutinsStats = await getScrutinsStats();
		console.log(`Total scrutins: ${scrutinsStats.total}`);
		console.log('Par législature:');
		for (const [leg, count] of Object.entries(scrutinsStats.byLegislature).sort(
			(a, b) => parseInt(a[0]) - parseInt(b[0])
		)) {
			console.log(`  Législature ${leg}: ${count} scrutins`);
		}

		if (statsOnly) {
			process.exit(0);
		}

		console.log('\nPour importer les données, utilisez:');
		console.log('  --organes  : Importer les organes (ASSEMBLEE + GP)');
		console.log('  --deputes  : Importer les députés');
		console.log('  --mandats  : Importer les mandats');
		console.log('  --scrutins : Importer les scrutins (15e-17e législatures)');
		console.log('  --votes    : Importer les votes nominatifs');
		console.log('  --all      : Tout importer');
		console.log('  --leg=N    : Filtrer par législature (ex: --leg=17)');
		process.exit(0);
	}

	console.log('=== Import données Assemblée Nationale ===');
	if (legislature) {
		console.log(`Filtré sur la législature ${legislature}`);
	}

	const allStatsArr: Array<{
		total: number;
		inserted: number;
		updated: number;
		skipped: number;
		errors: number;
	}> = [];

	// Import organes first (needed for mandates FK)
	if (importOrganes) {
		console.log('\n--- Organes (ASSEMBLEE + GP) ---');
		const organesStats = await importOrganesFromAN(config);
		allStatsArr.push(organesStats);
		console.log(`Organes: ${organesStats.inserted} importés, ${organesStats.errors} erreurs`);
	}

	// Import députés
	if (importDeputes) {
		console.log('\n--- Députés ---');
		const deputesStats = await importDeputesFromAN(config);
		allStatsArr.push(deputesStats);
		console.log(`Députés: ${deputesStats.inserted} importés, ${deputesStats.errors} erreurs`);
	}

	// Import mandats
	if (importMandats) {
		console.log('\n--- Mandats ---');
		const mandatsStats = await importMandatsFromAN(config);
		allStatsArr.push(mandatsStats);
		console.log(`Mandats: ${mandatsStats.inserted} importés, ${mandatsStats.errors} erreurs`);
	}

	// Import scrutins
	if (importScrutins) {
		console.log('\n--- Scrutins ---');
		const scrutinsStats = await importScrutinsFromAN(config, legislature);
		allStatsArr.push(scrutinsStats);
		console.log(`Scrutins: ${scrutinsStats.inserted} importés, ${scrutinsStats.errors} erreurs`);
	}

	// Import votes
	if (importVotes) {
		console.log('\n--- Votes nominatifs ---');
		const votesStats = await importVotesFromAN(config, legislature);
		allStatsArr.push(votesStats);
		console.log(`Votes: ${votesStats.inserted} importés, ${votesStats.errors} erreurs`);
	}

	console.log('\n=== Import terminé ===');

	// Notification Telegram avec stats combinées
	if (allStatsArr.length > 0) {
		const combinedStats = {
			total: allStatsArr.reduce((sum, s) => sum + s.total, 0),
			inserted: allStatsArr.reduce((sum, s) => sum + s.inserted, 0),
			updated: allStatsArr.reduce((sum, s) => sum + s.updated, 0),
			skipped: allStatsArr.reduce((sum, s) => sum + s.skipped, 0),
			errors: allStatsArr.reduce((sum, s) => sum + s.errors, 0)
		};
		await notifyETLComplete('import-an', combinedStats, {
			legislature: legislature || config.legislature
		});
	}

	process.exit(0);
}

main().catch((error) => {
	console.error('Erreur:', error);
	process.exit(1);
});
