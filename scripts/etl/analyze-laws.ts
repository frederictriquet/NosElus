/**
 * Script ETL pour analyser les textes de lois via la CLI Claude.
 *
 * Usage:
 *   npm run etl:analyze-laws
 *   npm run etl:analyze-laws -- --limit 50
 *   npm run etl:analyze-laws -- --dry-run
 *
 * Prérequis:
 *   - CLI Claude installée et connectée (claude --version)
 */

import 'dotenv/config';
import {
	analyzeLawsBatch,
	analyzeLaw,
	saveLawAnalysis,
	getAvailableTags
} from '../../src/lib/server/etl/sources/llm/law-analyzer.js';
import { detectClaude } from '../../src/lib/server/etl/sources/llm/claude-cli.js';
import { db } from '../../src/lib/server/db/index.js';
import { laws, lawSummaries } from '../../src/lib/server/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

interface Args {
	limit: number;
	legislature?: string;
	chamber?: 'AN' | 'PE';
	dryRun: boolean;
	help: boolean;
	reanalyze?: string; // ID de loi à ré-analyser
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
			case '--legislature':
				args.legislature = argv[++i];
				break;
			case '--chamber':
			case '-c':
				args.chamber = argv[++i] as 'AN' | 'PE';
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
  -r, --reanalyze <id>  Ré-analyser une loi spécifique (supprime l'ancien résumé)
  -n, --dry-run         Mode simulation, n'écrit pas en base
  -h, --help            Affiche cette aide

Tags disponibles (depuis la DB):
  ${tagNames}

Exemples:
  npm run etl:analyze-laws                   # Analyse 100 lois
  npm run etl:analyze-laws -- --limit 50     # Analyse 50 lois
  npm run etl:analyze-laws -- --dry-run      # Simulation

Prérequis:
  CLI Claude installée et connectée (claude --version)
`);
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

	// Mode ré-analyse d'une loi spécifique
	if (args.reanalyze) {
		console.log(`Ré-analyse de la loi: ${args.reanalyze}`);
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
			const analysis = await analyzeLaw(law, tagMappings);

			if (analysis.summary.startsWith('Erreur:')) {
				console.error(`Erreur: ${analysis.summary}`);
				console.error(`Réponse brute: ${analysis.rawResponse?.slice(0, 500)}`);
				process.exit(1);
			}

			// Sauvegarder
			if (!args.dryRun) {
				await saveLawAnalysis(args.reanalyze, analysis, 'claude');
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
				additionalInfo: {}
			}
		);

		process.exit(result.errors > 0 ? 1 : 0);
	} catch (error) {
		console.error('Erreur fatale:', error);
		process.exit(1);
	}
}

main();
