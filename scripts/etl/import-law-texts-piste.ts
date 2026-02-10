/**
 * ETL : Import des textes complets de lois via API Légifrance PISTE
 *
 * Stratégie de matching :
 * - Normalise les titres (minuscules, sans accents, sans ponctuation)
 * - Extrait les mots-clés significatifs (>3 lettres, hors stop words)
 * - Calcule un score de similarité Jaccard entre les ensembles de mots
 * - N'enrichit que si le score dépasse le seuil de confiance
 *
 * Usage:
 *   npm run etl:law-texts
 *   npm run etl:law-texts -- --limit 50
 *   npm run etl:law-texts -- --test-connection
 *   npm run etl:law-texts -- --threshold 0.5  # Score minimum (défaut: 0.4)
 *
 * Prérequis:
 *   - Compte PISTE: https://piste.gouv.fr/registration
 *   - Variables d'environnement: PISTE_CLIENT_ID, PISTE_CLIENT_SECRET
 */

import 'dotenv/config';
import {
	createLegifranceClient,
	type LegiTexteResponse
} from '../../src/lib/server/etl/sources/legifrance/client.js';
import {
	MAX_DESCRIPTION_LENGTH,
	calculateSimilarity,
	extractTextFromResponse
} from '../../src/lib/server/etl/sources/legifrance/text-matching.js';
import { db, laws, scrutins, lawTextSkipList } from '../../src/lib/server/db/index.js';
import { eq, isNull, and, desc, sql } from 'drizzle-orm';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

interface Args {
	limit: number;
	testConnection: boolean;
	dryRun: boolean;
	help: boolean;
	threshold: number;
	verbose: boolean;
	withScrutins: boolean; // Cibler les lois liées aux scrutins
	force: boolean; // Ignorer la skip list et re-tenter toutes les lois
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		limit: 50,
		testConnection: false,
		dryRun: false,
		help: false,
		threshold: 0.4, // Score minimum de similarité
		verbose: false,
		withScrutins: false,
		force: false
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case '--limit':
			case '-l':
				args.limit = parseInt(argv[++i], 10) || 50;
				break;
			case '--test-connection':
			case '-t':
				args.testConnection = true;
				break;
			case '--dry-run':
			case '-n':
				args.dryRun = true;
				break;
			case '--help':
			case '-h':
				args.help = true;
				break;
			case '--threshold':
				args.threshold = parseFloat(argv[++i]) || 0.4;
				break;
			case '--verbose':
			case '-v':
				args.verbose = true;
				break;
			case '--with-scrutins':
			case '-s':
				args.withScrutins = true;
				break;
			case '--force':
			case '-f':
				args.force = true;
				break;
		}
	}

	return args;
}

function printHelp() {
	console.log(`
Usage: npm run etl:law-texts -- [options]

Options:
  -l, --limit <n>       Nombre max de lois à enrichir (défaut: 50)
  -t, --test-connection Tester la connexion à l'API PISTE
  -n, --dry-run         Mode simulation, n'écrit pas en base
  -s, --with-scrutins   Cibler les lois liées aux scrutins (prioritaire)
  -f, --force           Ignorer la skip list et re-tenter toutes les lois
  --threshold <f>       Score de similarité minimum (défaut: 0.4)
  -v, --verbose         Affiche les détails du matching
  -h, --help            Affiche cette aide

Exemples:
  npm run etl:law-texts -- --test-connection
  npm run etl:law-texts -- --limit 10 --dry-run
  npm run etl:law-texts -- --with-scrutins --limit 20
  npm run etl:law-texts -- --threshold 0.5 --verbose
  npm run etl:law-texts -- --force --limit 10  # Re-tente les lois de la skip list

Configuration requise (.env):
  PISTE_CLIENT_ID=your-oauth-client-id
  PISTE_CLIENT_SECRET=your-oauth-client-secret
  PISTE_ENV=production
`);
}

// ============================================================
// Fonctions de base de données
// ============================================================

/**
 * Récupère les dossiers législatifs sans description
 * @param limit - Nombre max de résultats
 * @param withScrutins - Si true, cible les lois liées aux scrutins
 */
async function getLawsToEnrich(limit: number, withScrutins: boolean, force: boolean) {
	if (withScrutins) {
		// Lois liées aux scrutins, sans description
		const query = db
			.selectDistinct({
				id: laws.id,
				title: laws.title,
				status: laws.status,
				promulgationDate: laws.promulgationDate
			})
			.from(laws)
			.innerJoin(scrutins, eq(scrutins.lawId, laws.id));

		if (!force) {
			query.leftJoin(lawTextSkipList, eq(laws.id, lawTextSkipList.lawId));
		}

		const results = await query
			.where(
				force
					? isNull(laws.description)
					: and(isNull(laws.description), isNull(lawTextSkipList.lawId))
			)
			.limit(limit);

		return results;
	}

	// Mode par défaut: lois promulguées sans description
	const query = db
		.select({
			id: laws.id,
			title: laws.title,
			status: laws.status,
			promulgationDate: laws.promulgationDate
		})
		.from(laws);

	if (!force) {
		query.leftJoin(lawTextSkipList, eq(laws.id, lawTextSkipList.lawId));
	}

	const results = await query
		.where(
			force
				? and(eq(laws.status, 'promulgué'), isNull(laws.description))
				: and(eq(laws.status, 'promulgué'), isNull(laws.description), isNull(lawTextSkipList.lawId))
		)
		.orderBy(desc(laws.promulgationDate))
		.limit(limit);

	return results;
}

// ============================================================
// Fonction principale de matching
// ============================================================

interface MatchResult {
	found: boolean;
	legifranceTitle?: string;
	score?: number;
	textId?: string;
	text?: string;
}

/**
 * Cherche une correspondance sur Légifrance pour un dossier législatif
 */
async function findMatchingLaw(
	client: ReturnType<typeof createLegifranceClient>,
	dossierTitle: string,
	threshold: number,
	verbose: boolean
): Promise<MatchResult> {
	// Parcourir les lois Légifrance par pages
	let bestMatch: MatchResult = { found: false };
	let bestScore = 0;

	// On cherche dans les 500 premières lois (les plus récentes)
	const maxPages = 5;
	const pageSize = 100;

	for (let page = 1; page <= maxPages; page++) {
		const searchResult = await client.searchLois({
			nature: 'LOI',
			pageSize,
			pageNumber: page
		});

		if (!searchResult.results || searchResult.results.length === 0) {
			break;
		}

		for (const result of searchResult.results) {
			const legiTitle = result.titre;
			if (!legiTitle) continue;

			const { score } = calculateSimilarity(dossierTitle, legiTitle, false);

			if (score > bestScore) {
				bestScore = score;
				bestMatch = {
					found: score >= threshold,
					legifranceTitle: legiTitle,
					score,
					textId: result.id
				};

				// Si on a un très bon match, on arrête de chercher
				if (score >= 0.7) {
					if (verbose) {
						console.log(`    → Match excellent trouvé (score: ${score.toFixed(3)})`);
						calculateSimilarity(dossierTitle, legiTitle, true);
					}
					return bestMatch;
				}
			}
		}

		// Rate limiting entre les pages
		await new Promise((r) => setTimeout(r, 200));
	}

	if (verbose && bestMatch.legifranceTitle) {
		console.log(`    → Meilleur match: score ${bestScore.toFixed(3)}`);
		calculateSimilarity(dossierTitle, bestMatch.legifranceTitle, true);
	}

	return bestMatch;
}

// ============================================================
// Main
// ============================================================

interface EnrichResult {
	total: number;
	success: number;
	lowScore: number;
	notFound: number;
	errors: number;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	console.log('='.repeat(60));
	console.log('NosElus ETL - Import Textes Complets (Légifrance PISTE)');
	console.log('='.repeat(60));
	console.log('');

	// Créer le client
	let client;
	try {
		client = createLegifranceClient();
		console.log(`Environnement PISTE: ${process.env.PISTE_ENV || 'sandbox'}`);
	} catch (error) {
		console.error('ERREUR:', (error as Error).message);
		console.error('');
		console.error('Configurez les variables dans .env:');
		console.error('  PISTE_CLIENT_ID=...');
		console.error('  PISTE_CLIENT_SECRET=...');
		console.error('  PISTE_ENV=production');
		process.exit(1);
	}

	// Mode test de connexion
	if (args.testConnection) {
		console.log("Test de connexion à l'API PISTE...");
		const ok = await client.testConnection();
		process.exit(ok ? 0 : 1);
	}

	// Mode normal : enrichir les lois
	console.log('Configuration:');
	console.log(`  Limite: ${args.limit} dossiers`);
	console.log(`  Seuil de similarité: ${args.threshold}`);
	if (args.withScrutins) {
		console.log('  Cible: lois liées aux scrutins');
	} else {
		console.log('  Cible: lois promulguées');
	}
	if (args.dryRun) {
		console.log("  Mode: DRY RUN (pas d'écriture en base)");
	}
	if (args.force) {
		console.log('  Mode: FORCE (skip list ignorée)');
	}
	if (args.verbose) {
		console.log('  Mode verbeux activé');
	}
	console.log('');

	// Récupérer les dossiers à enrichir
	const targetDesc = args.withScrutins ? 'liés aux scrutins' : 'promulgués';
	console.log(`Recherche des dossiers ${targetDesc} sans texte complet...`);
	const lawsToEnrich = await getLawsToEnrich(args.limit, args.withScrutins, args.force);
	console.log(`  ${lawsToEnrich.length} dossiers trouvés`);
	console.log('');

	if (lawsToEnrich.length === 0) {
		console.log('Aucun dossier à enrichir.');
		process.exit(0);
	}

	const result: EnrichResult = {
		total: lawsToEnrich.length,
		success: 0,
		lowScore: 0,
		notFound: 0,
		errors: 0
	};

	// Cache des lois Légifrance déjà récupérées
	const textCache = new Map<string, LegiTexteResponse>();

	// Traiter chaque dossier
	for (let i = 0; i < lawsToEnrich.length; i++) {
		const law = lawsToEnrich[i];
		const progress = `[${i + 1}/${lawsToEnrich.length}]`;

		console.log(`${progress} ${law.id}`);
		console.log(`  Titre: ${law.title.slice(0, 70)}${law.title.length > 70 ? '...' : ''}`);

		try {
			// Rate limiting
			if (i > 0) {
				await new Promise((r) => setTimeout(r, 300));
			}

			// Chercher une correspondance
			const match = await findMatchingLaw(client, law.title, args.threshold, args.verbose);

			if (!match.found) {
				if (match.score !== undefined && match.score > 0) {
					console.log(`  → Score insuffisant: ${match.score.toFixed(3)} < ${args.threshold}`);
					console.log(`    Meilleur candidat: ${match.legifranceTitle?.slice(0, 60)}...`);
					result.lowScore++;

					if (!args.dryRun) {
						await db
							.insert(lawTextSkipList)
							.values({
								lawId: law.id,
								reason: 'low_score',
								bestScore: match.score,
								bestMatchTitle: match.legifranceTitle ?? null,
								bestMatchTextId: match.textId ?? null,
								threshold: args.threshold
							})
							.onConflictDoUpdate({
								target: lawTextSkipList.lawId,
								set: {
									reason: 'low_score',
									bestScore: match.score,
									bestMatchTitle: match.legifranceTitle ?? null,
									bestMatchTextId: match.textId ?? null,
									threshold: args.threshold,
									attemptedAt: sql`now()`
								}
							});
					}
				} else {
					console.log('  → Aucune correspondance trouvée');
					result.notFound++;

					if (!args.dryRun) {
						await db
							.insert(lawTextSkipList)
							.values({
								lawId: law.id,
								reason: 'not_found',
								threshold: args.threshold
							})
							.onConflictDoUpdate({
								target: lawTextSkipList.lawId,
								set: {
									reason: 'not_found',
									bestScore: null,
									bestMatchTitle: null,
									threshold: args.threshold,
									attemptedAt: sql`now()`
								}
							});
					}
				}
				continue;
			}

			console.log(`  → Match trouvé (score: ${match.score?.toFixed(3)})`);
			console.log(`    Légifrance: ${match.legifranceTitle?.slice(0, 60)}...`);

			if (args.dryRun) {
				console.log("  → [DRY RUN] N'écrit pas en base");
				result.success++;
				continue;
			}

			// Récupérer le texte complet
			let texte = textCache.get(match.textId!);
			if (!texte) {
				texte = await client.getTexteComplet(match.textId!);
				textCache.set(match.textId!, texte);
			}

			// Extraire le texte
			const fullText = extractTextFromResponse(texte);

			if (fullText.length < 100) {
				console.log(`  → Texte trop court (${fullText.length} caractères), ignoré`);
				result.notFound++;

				await db
					.insert(lawTextSkipList)
					.values({
						lawId: law.id,
						reason: 'text_too_short',
						bestScore: match.score ?? null,
						bestMatchTitle: match.legifranceTitle ?? null,
						bestMatchTextId: match.textId ?? null,
						threshold: args.threshold
					})
					.onConflictDoUpdate({
						target: lawTextSkipList.lawId,
						set: {
							reason: 'text_too_short',
							bestScore: match.score ?? null,
							bestMatchTitle: match.legifranceTitle ?? null,
							bestMatchTextId: match.textId ?? null,
							threshold: args.threshold,
							attemptedAt: sql`now()`
						}
					});

				continue;
			}

			console.log(`  → ${fullText.length} caractères extraits`);

			// Mettre à jour en base
			await db
				.update(laws)
				.set({
					description: fullText.slice(0, MAX_DESCRIPTION_LENGTH),
					updatedAt: new Date()
				})
				.where(eq(laws.id, law.id));

			result.success++;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.log(`  → Erreur: ${message}`);
			result.errors++;
		}
	}

	// Résumé
	console.log('');
	console.log('='.repeat(60));
	console.log('Résultats:');
	console.log(`  Total traité:       ${result.total} dossiers`);
	console.log(`  Enrichis:           ${result.success}`);
	console.log(`  Score insuffisant:  ${result.lowScore}`);
	console.log(`  Non trouvés:        ${result.notFound}`);
	console.log(`  Erreurs:            ${result.errors}`);
	console.log('='.repeat(60));

	await notifyETLComplete(
		'import-law-texts-piste',
		{
			total: result.total,
			inserted: 0,
			updated: result.success,
			skipped: result.lowScore + result.notFound,
			errors: result.errors
		},
		{ dryRun: args.dryRun }
	);

	process.exit(result.errors > 0 ? 1 : 0);
}

main();
