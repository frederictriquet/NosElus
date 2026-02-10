/**
 * ETL : Enrichissement des textes de lois PE
 *
 * Récupère le contenu des pages liées via l'API HowTheyVote.eu
 * pour enrichir laws.description des lois du Parlement Européen.
 *
 * Sources par priorité :
 * 1. OEIL Summary (résumé officiel du Legislative Observatory)
 * 2. Press release (communiqué de presse du PE)
 * 3. Snippet HTV (extrait court déjà en cache)
 * 4. Report/Resolution (texte légal complet, fallback)
 *
 * Usage:
 *   npm run etl:europarl-law-texts
 *   npm run etl:europarl-law-texts -- --dry-run
 *   npm run etl:europarl-law-texts -- --limit 5 --verbose
 */

import {
	enrichPELawTexts,
	type EnrichConfig
} from '../../src/lib/server/etl/sources/europarl/law-texts';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

interface Args {
	dryRun: boolean;
	limit: number;
	verbose: boolean;
	help: boolean;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		dryRun: false,
		limit: 100,
		verbose: false,
		help: false
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case '--dry-run':
			case '-n':
				args.dryRun = true;
				break;
			case '--limit':
			case '-l':
				args.limit = parseInt(argv[++i], 10) || 100;
				break;
			case '--verbose':
			case '-v':
				args.verbose = true;
				break;
			case '--help':
			case '-h':
				args.help = true;
				break;
		}
	}

	return args;
}

function printHelp() {
	console.log(`
Usage: npm run etl:europarl-law-texts [options]

Options:
  --dry-run, -n     Simulation (pas d'écriture en base)
  --limit N, -l N   Nombre max de lois à traiter (défaut: 100)
  --verbose, -v     Logs détaillés
  --help, -h        Affiche cette aide
`);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	console.log('='.repeat(60));
	console.log('NosElus ETL - Enrichissement textes lois PE');
	console.log('Source: API HowTheyVote.eu + pages web');
	console.log('='.repeat(60));
	console.log('');

	console.log('Configuration:');
	console.log(`  Limite: ${args.limit} lois`);
	if (args.dryRun) {
		console.log("  Mode: DRY RUN (pas d'écriture en base)");
	}
	if (args.verbose) {
		console.log('  Mode verbeux activé');
	}
	console.log('');

	try {
		const config: EnrichConfig = {
			dryRun: args.dryRun,
			limit: args.limit,
			verbose: args.verbose
		};

		const stats = await enrichPELawTexts(config);

		console.log('');
		console.log('='.repeat(60));
		console.log('RÉSUMÉ');
		console.log('='.repeat(60));
		console.log(`  Lois traitées:   ${stats.total}`);
		console.log(`  Enrichies:       ${stats.updated}`);
		console.log(`  Ignorées:        ${stats.skipped}`);
		console.log(`  Erreurs:         ${stats.errors}`);
		console.log('='.repeat(60));

		await notifyETLComplete('enrich-europarl-law-texts', stats, { dryRun: args.dryRun });
	} catch (error) {
		console.error('Erreur fatale:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
