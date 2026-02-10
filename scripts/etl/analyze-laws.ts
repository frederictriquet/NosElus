/**
 * Script ETL pour analyser les textes de lois avec un LLM local (Ollama).
 *
 * Usage:
 *   npm run etl:analyze-laws
 *   npm run etl:analyze-laws -- --limit 50
 *   npm run etl:analyze-laws -- --model llama3.1
 *   npm run etl:analyze-laws -- --dry-run
 *
 * Prérequis:
 *   1. Ollama installé: https://ollama.com
 *   2. Modèle téléchargé: ollama pull mistral-nemo
 *   3. Ollama lancé: ollama serve
 */

import 'dotenv/config';
import {
	analyzeLawsBatch,
	analyzeLaw,
	saveLawAnalysis,
	getAvailableTags
} from '../../src/lib/server/etl/sources/llm/law-analyzer.js';
import { db } from '../../src/lib/server/db/index.js';
import { laws, lawSummaries } from '../../src/lib/server/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

interface Args {
	limit: number;
	legislature?: string;
	chamber?: 'AN' | 'PE';
	model: string;
	dryRun: boolean;
	help: boolean;
	reanalyze?: string; // ID de loi à ré-analyser
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
			case '--legislature':
				args.legislature = argv[++i];
				break;
			case '--chamber':
			case '-c':
				args.chamber = argv[++i] as 'AN' | 'PE';
				break;
			case '--model':
			case '-m':
				args.model = argv[++i] || 'mistral';
				break;
			case '--dry-run':
			case '-n':
				args.dryRun = true;
				break;
			case '--reanalyze':
			case '-r':
				args.reanalyze = argv[++i];
				break;
			case '--help':
			case '-h':
				args.help = true;
				break;
		}
	}

	return args;
}

async function printHelp() {
	const tagMappings = await getAvailableTags();
	const tagNames = tagMappings.map((t) => t.promptName).join(', ');

	console.log(`
Usage: npm run etl:analyze-laws -- [options]

Options:
  -l, --limit <n>       Nombre max de lois à analyser (défaut: 100)
  -c, --chamber <AN|PE> Filtrer par chambre (AN ou PE)
  --legislature <leg>   Filtrer par législature (ex: 17)
  -m, --model <name>    Modèle Ollama à utiliser (défaut: mistral-nemo)
  -r, --reanalyze <id>  Ré-analyser une loi spécifique (supprime l'ancien résumé)
  -n, --dry-run         Mode simulation, n'écrit pas en base
  -h, --help            Affiche cette aide

Tags disponibles (depuis la DB):
  ${tagNames}

Exemples:
  npm run etl:analyze-laws                      # Analyse 100 lois
  npm run etl:analyze-laws -- --limit 50        # Analyse 50 lois
  npm run etl:analyze-laws -- --model llama3.1  # Utilise Llama 3.1
  npm run etl:analyze-laws -- --dry-run         # Simulation

Prérequis:
  1. Installer Ollama: https://ollama.com
  2. Télécharger un modèle: ollama pull mistral-nemo
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
		await printHelp();
		process.exit(0);
	}

	console.log('='.repeat(60));
	console.log('NosElus ETL - Analyse des Lois avec LLM');
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

	// Mode ré-analyse d'une loi spécifique
	if (args.reanalyze) {
		console.log(`Ré-analyse de la loi: ${args.reanalyze}`);
		console.log(`  Modèle: ${args.model}`);
		console.log('');

		try {
			// Récupérer la loi et les tags en parallèle
			const [[law], tagMappings] = await Promise.all([
				db.select().from(laws).where(eq(laws.id, args.reanalyze)),
				getAvailableTags()
			]);
			if (!law) {
				console.error(`Erreur: Loi ${args.reanalyze} non trouvée`);
				process.exit(1);
			}

			if (!law.description) {
				console.error(`Erreur: Loi ${args.reanalyze} n'a pas de texte complet`);
				process.exit(1);
			}

			console.log(`Titre: ${law.title.slice(0, 60)}...`);
			console.log(`Texte: ${law.description.length} caractères`);
			console.log(`Tags disponibles: ${tagMappings.map((t) => t.promptName).join(', ')}`);
			console.log('');

			// Supprimer l'ancien résumé s'il existe
			await db.delete(lawSummaries).where(eq(lawSummaries.lawId, args.reanalyze));
			console.log("Ancien résumé supprimé (s'il existait)");

			// Analyser
			console.log('Analyse en cours...');
			const analysis = await analyzeLaw(law, { model: args.model }, tagMappings);

			if (analysis.summary.startsWith('Erreur:')) {
				console.error(`Erreur: ${analysis.summary}`);
				console.error(`Réponse brute: ${analysis.rawResponse?.slice(0, 500)}`);
				process.exit(1);
			}

			// Sauvegarder
			if (!args.dryRun) {
				await saveLawAnalysis(args.reanalyze, analysis, args.model);
				console.log('Résumé sauvegardé');
			}

			console.log('');
			console.log('='.repeat(60));
			console.log('Résultat:');
			console.log(`  Résumé: ${analysis.summary}`);
			console.log(`  Tags: ${analysis.tags.join(', ')}`);
			console.log('='.repeat(60));

			// Notification Telegram
			await notifyETLComplete(
				'analyze-laws',
				{
					total: 1,
					inserted: analysis.summary.startsWith('Erreur:') ? 0 : 1,
					updated: 0,
					skipped: 0,
					errors: analysis.summary.startsWith('Erreur:') ? 1 : 0
				},
				{
					dryRun: args.dryRun,
					legislature: law.legislature,
					additionalInfo: { mode: 'reanalyze', lawId: args.reanalyze }
				}
			);

			process.exit(0);
		} catch (error) {
			console.error('Erreur:', error);
			process.exit(1);
		}
	}

	console.log('Configuration:');
	console.log(`  Modèle: ${args.model}`);
	console.log(`  Limite: ${args.limit} lois`);
	if (args.chamber) {
		console.log(`  Chambre: ${args.chamber}`);
	}
	if (args.legislature) {
		console.log(`  Législature: ${args.legislature}`);
	}
	if (args.dryRun) {
		console.log("  Mode: DRY RUN (pas d'écriture en base)");
	}
	console.log('');

	try {
		const result = await analyzeLawsBatch({
			limit: args.limit,
			legislature: args.legislature,
			chamber: args.chamber,
			model: args.model,
			dryRun: args.dryRun
		});

		console.log('');
		console.log('='.repeat(60));
		console.log('Résultats:');
		console.log(`  Total: ${result.total} lois`);
		console.log(`  Succès: ${result.success}`);
		console.log(`  Erreurs: ${result.errors}`);
		if (result.skipped > 0) {
			console.log(`  Ignorées (dry-run): ${result.skipped}`);
		}
		console.log('='.repeat(60));

		// Notification Telegram
		await notifyETLComplete(
			'analyze-laws',
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
				additionalInfo: { model: args.model }
			}
		);

		process.exit(result.errors > 0 ? 1 : 0);
	} catch (error) {
		console.error('Erreur fatale:', error);
		process.exit(1);
	}
}

main();
