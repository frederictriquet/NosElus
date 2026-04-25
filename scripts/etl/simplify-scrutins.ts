/**
 * Script ETL pour générer des titres simplifiés pour les scrutins parlementaires
 * via la CLI Claude.
 *
 * Usage:
 *   npm run etl:simplify-scrutins
 *   npm run etl:simplify-scrutins -- --limit 50
 *   npm run etl:simplify-scrutins -- --category vote-final
 *   npm run etl:simplify-scrutins -- --legislature 17
 *   npm run etl:simplify-scrutins -- --dry-run
 *
 * Prérequis:
 *   - CLI Claude installée et connectée (claude --version)
 */

import 'dotenv/config';
import {
	simplifyScrutinsBatch,
	simplifyScrutinTitle,
	saveScrutinTitleSimple
} from '../../src/lib/server/etl/sources/llm/scrutin-simplifier.js';
import { detectClaude } from '../../src/lib/server/etl/sources/llm/claude-cli.js';
import { db } from '../../src/lib/server/db/index.js';
import { scrutins } from '../../src/lib/server/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

interface Args {
	limit: number;
	category?: string;
	legislature?: string;
	dryRun: boolean;
	help: boolean;
	redo?: string; // ID de scrutin à re-générer (écrase title_simple existant)
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		limit: 100,
		dryRun: false,
		help: false
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case '--limit':
			case '-l':
				args.limit = parseInt(argv[++i], 10) || 100;
				break;
			case '--category':
			case '-c':
				args.category = argv[++i];
				break;
			case '--legislature':
				args.legislature = argv[++i];
				break;
			case '--dry-run':
			case '-n':
				args.dryRun = true;
				break;
			case '--redo':
			case '-r':
				args.redo = argv[++i];
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
Usage: npm run etl:simplify-scrutins -- [options]

Options:
  -l, --limit <n>        Nombre max de scrutins à traiter (défaut: 100)
  -c, --category <cat>   Filtrer par catégorie (vote-final, amendement, article…)
  --legislature <leg>    Filtrer par législature (ex: 17, 16)
  -r, --redo <id>        Re-générer le titre d'un scrutin spécifique (écrase l'existant)
  -n, --dry-run          Mode simulation, n'écrit pas en base
  -h, --help             Affiche cette aide

Catégories disponibles:
  vote-final, amendement, article, budget, constitutionnel, procédure, autre

Exemples:
  npm run etl:simplify-scrutins                                    # 100 scrutins
  npm run etl:simplify-scrutins -- --category vote-final           # votes finaux uniquement
  npm run etl:simplify-scrutins -- --category vote-final --limit 20
  npm run etl:simplify-scrutins -- --legislature 17 --limit 50
  npm run etl:simplify-scrutins -- --dry-run                       # simulation
  npm run etl:simplify-scrutins -- --redo VTANR5L17V5244           # re-générer un scrutin

Prérequis:
  CLI Claude installée et connectée (claude --version)
`);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	console.log('='.repeat(60));
	console.log('NosElus ETL - Simplification des titres de scrutins (LLM)');
	console.log('='.repeat(60));
	console.log('');

	// Vérifier la disponibilité de la CLI Claude
	console.log('Vérification de la CLI Claude...');
	const claudeOk = await detectClaude();

	if (!claudeOk) {
		console.error('');
		console.error('ERREUR: CLI Claude introuvable.');
		console.error('');
		console.error('Assurez-vous que:');
		console.error('  1. La CLI Claude est installée');
		console.error('  2. Vous êtes connecté (claude --version)');
		console.error('');
		process.exit(1);
	}

	console.log('  ✓ CLI Claude disponible');
	console.log('');

	// Mode re-génération d'un scrutin spécifique
	if (args.redo) {
		console.log(`Re-génération du titre pour: ${args.redo}`);
		console.log('');

		const [scrutin] = await db
			.select({
				id: scrutins.id,
				title: scrutins.title,
				category: scrutins.category,
				titleSimple: scrutins.titleSimple
			})
			.from(scrutins)
			.where(eq(scrutins.id, args.redo));

		if (!scrutin) {
			console.error(`Erreur: scrutin ${args.redo} non trouvé`);
			process.exit(1);
		}

		console.log(`Titre actuel: ${scrutin.title.slice(0, 80)}`);
		if (scrutin.titleSimple) {
			console.log(`Titre simple actuel: ${scrutin.titleSimple}`);
		}
		console.log('');

		const titleSimple = await simplifyScrutinTitle(scrutin);

		if (!titleSimple) {
			console.error('Erreur: titre non généré');
			process.exit(1);
		}

		console.log(`Nouveau titre simple: "${titleSimple}"`);

		if (!args.dryRun) {
			await saveScrutinTitleSimple(args.redo!, titleSimple);
			console.log('✓ Sauvegardé en base');
		} else {
			console.log('[DRY RUN] Non sauvegardé');
		}

		process.exit(0);
	}

	// Mode batch
	console.log('Configuration:');
	console.log(`  Limite: ${args.limit} scrutins`);
	if (args.category) console.log(`  Catégorie: ${args.category}`);
	if (args.legislature) console.log(`  Législature: ${args.legislature}`);
	if (args.dryRun) console.log("  Mode: DRY RUN (pas d'écriture en base)");
	console.log('');

	try {
		const result = await simplifyScrutinsBatch({
			limit: args.limit,
			category: args.category,
			legislature: args.legislature,
			dryRun: args.dryRun
		});

		console.log('');
		console.log('='.repeat(60));
		console.log('Résultats:');
		console.log(`  Total: ${result.total} scrutins`);
		console.log(`  Succès: ${result.success}`);
		console.log(`  Erreurs: ${result.errors}`);
		if (result.skipped > 0) console.log(`  Ignorés (dry-run): ${result.skipped}`);
		console.log('='.repeat(60));

		await notifyETLComplete(
			'simplify-scrutins',
			{
				total: result.total,
				inserted: result.success,
				updated: 0,
				skipped: result.skipped,
				errors: result.errors
			},
			{
				dryRun: args.dryRun,
				legislature: args.legislature,
				additionalInfo: { category: args.category }
			}
		);

		process.exit(result.errors > 0 ? 1 : 0);
	} catch (err) {
		console.error('Erreur fatale:', err);
		process.exit(1);
	}
}

main();
