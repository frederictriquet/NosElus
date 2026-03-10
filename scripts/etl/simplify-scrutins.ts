/**
 * Script ETL pour générer des titres simplifiés pour les scrutins parlementaires
 * via un LLM local (Ollama/mistral-nemo).
 *
 * Usage:
 *   npm run etl:simplify-scrutins
 *   npm run etl:simplify-scrutins -- --limit 50
 *   npm run etl:simplify-scrutins -- --category vote-final
 *   npm run etl:simplify-scrutins -- --legislature 17
 *   npm run etl:simplify-scrutins -- --dry-run
 *
 * Prérequis:
 *   1. Ollama installé: https://ollama.com
 *   2. Modèle téléchargé: ollama pull mistral-nemo
 *   3. Ollama lancé: ollama serve
 */

import 'dotenv/config';
import {
	simplifyScrutinsBatch,
	simplifyScrutinTitle,
	saveScrutinTitleSimple
} from '../../src/lib/server/etl/sources/llm/scrutin-simplifier.js';
import { db } from '../../src/lib/server/db/index.js';
import { scrutins } from '../../src/lib/server/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

interface Args {
	limit: number;
	category?: string;
	legislature?: string;
	model: string;
	dryRun: boolean;
	help: boolean;
	redo?: string; // ID de scrutin à re-générer (écrase title_simple existant)
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		limit: 100,
		model: 'mistral-nemo',
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
			case '--model':
			case '-m':
				args.model = argv[++i] || 'mistral-nemo';
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
  -m, --model <name>     Modèle Ollama à utiliser (défaut: mistral-nemo)
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
  1. Installer Ollama: https://ollama.com
  2. Télécharger le modèle: ollama pull mistral-nemo
  3. Lancer Ollama: ollama serve (dans un terminal séparé)
`);
}

async function checkOllamaConnection(baseUrl: string): Promise<boolean> {
	try {
		const response = await fetch(`${baseUrl}/api/tags`, {
			signal: AbortSignal.timeout(5000)
		});
		return response.ok;
	} catch {
		return false;
	}
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

	// Vérifier la connexion à Ollama
	console.log('Vérification de la connexion à Ollama...');
	const ollamaOk = await checkOllamaConnection('http://localhost:11434');

	if (!ollamaOk) {
		console.error('');
		console.error('ERREUR: Impossible de se connecter à Ollama.');
		console.error('');
		console.error('Assurez-vous que:');
		console.error('  1. Ollama est installé: https://ollama.com');
		console.error('  2. Ollama est lancé: ollama serve');
		console.error(`  3. Le modèle est téléchargé: ollama pull ${args.model}`);
		console.error('');
		process.exit(1);
	}

	console.log('  ✓ Ollama est accessible');
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

		const titleSimple = await simplifyScrutinTitle(scrutin, { model: args.model });

		if (!titleSimple) {
			console.error('Erreur: titre non généré');
			process.exit(1);
		}

		console.log(`Nouveau titre simple: "${titleSimple}"`);

		if (!args.dryRun) {
			await saveScrutinTitleSimple(args.redo, titleSimple);
			console.log('✓ Sauvegardé en base');
		} else {
			console.log('[DRY RUN] Non sauvegardé');
		}

		process.exit(0);
	}

	// Mode batch
	console.log('Configuration:');
	console.log(`  Modèle: ${args.model}`);
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
			model: args.model,
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
				additionalInfo: { model: args.model, category: args.category }
			}
		);

		process.exit(result.errors > 0 ? 1 : 0);
	} catch (err) {
		console.error('Erreur fatale:', err);
		process.exit(1);
	}
}

main();
