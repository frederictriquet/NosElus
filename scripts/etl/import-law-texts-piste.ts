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

import {
	createLegifranceClient,
	type LegiTexteResponse
} from '../../src/lib/server/etl/sources/legifrance/client.js';
import { db, laws, scrutins } from '../../src/lib/server/db/index.js';
import { eq, isNull, and, desc } from 'drizzle-orm';

// ============================================================
// Configuration
// ============================================================

/** Limite de taille pour le champ description en base (50KB) */
const MAX_DESCRIPTION_LENGTH = 50000;

const STOP_WORDS = new Set([
	// Articles et prépositions
	'le',
	'la',
	'les',
	'un',
	'une',
	'des',
	'du',
	'de',
	'au',
	'aux',
	'en',
	'et',
	'ou',
	'par',
	'pour',
	'sur',
	'dans',
	'avec',
	'sans',
	'sous',
	'entre',
	'vers',
	'chez',
	// Mots courants dans les titres de loi
	'loi',
	'projet',
	'proposition',
	'relative',
	'relatif',
	'visant',
	'portant',
	'tendant',
	'modifiant',
	'complétant',
	'diverses',
	'dispositions',
	'mesures',
	'article',
	'articles',
	'code',
	'decret',
	'ordonnance',
	// Autres
	'qui',
	'que',
	'dont',
	'sont',
	'est',
	'cette',
	'ces',
	'ete',
	'etre',
	'avoir',
	'fait',
	'faire'
]);

interface Args {
	limit: number;
	testConnection: boolean;
	dryRun: boolean;
	help: boolean;
	threshold: number;
	verbose: boolean;
	withScrutins: boolean; // Cibler les lois liées aux scrutins
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		limit: 50,
		testConnection: false,
		dryRun: false,
		help: false,
		threshold: 0.4, // Score minimum de similarité
		verbose: false,
		withScrutins: false
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
  --threshold <f>       Score de similarité minimum (défaut: 0.4)
  -v, --verbose         Affiche les détails du matching
  -h, --help            Affiche cette aide

Exemples:
  npm run etl:law-texts -- --test-connection
  npm run etl:law-texts -- --limit 10 --dry-run
  npm run etl:law-texts -- --with-scrutins --limit 20
  npm run etl:law-texts -- --threshold 0.5 --verbose

Configuration requise (.env):
  PISTE_CLIENT_ID=your-oauth-client-id
  PISTE_CLIENT_SECRET=your-oauth-client-secret
  PISTE_ENV=production
`);
}

// ============================================================
// Fonctions de normalisation et similarité
// ============================================================

/**
 * Normalise un texte : minuscules, sans accents, sans ponctuation
 */
function normalize(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Supprime les accents
		.replace(/[^a-z0-9\s]/g, ' ') // Garde lettres, chiffres, espaces
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Extrait les mots-clés significatifs d'un titre
 */
function extractKeywords(title: string): Set<string> {
	const normalized = normalize(title);
	const words = normalized.split(' ');

	return new Set(
		words.filter((word) => {
			// Garde les mots de plus de 3 lettres
			if (word.length <= 3) return false;
			// Exclut les stop words
			if (STOP_WORDS.has(word)) return false;
			// Exclut les nombres purs (sauf années)
			if (/^\d+$/.test(word) && (word.length !== 4 || !word.startsWith('20'))) return false;
			return true;
		})
	);
}

/**
 * Calcule le coefficient de Jaccard entre deux ensembles
 * (intersection / union)
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
	if (set1.size === 0 && set2.size === 0) return 0;

	const intersection = new Set([...set1].filter((x) => set2.has(x)));
	const union = new Set([...set1, ...set2]);

	return intersection.size / union.size;
}

/**
 * Calcule un score de similarité amélioré
 * Combine Jaccard avec un bonus pour les mots rares partagés
 */
function calculateSimilarity(
	title1: string,
	title2: string,
	verbose: boolean = false
): { score: number; keywords1: Set<string>; keywords2: Set<string>; common: Set<string> } {
	const keywords1 = extractKeywords(title1);
	const keywords2 = extractKeywords(title2);

	const common = new Set([...keywords1].filter((x) => keywords2.has(x)));
	const baseScore = jaccardSimilarity(keywords1, keywords2);

	// Bonus si les mots communs sont "significatifs" (longs ou rares)
	let bonus = 0;
	for (const word of common) {
		if (word.length >= 8) bonus += 0.05; // Mots longs
		if (/^\d{4}$/.test(word)) bonus += 0.1; // Années
	}

	const finalScore = Math.min(1, baseScore + bonus);

	if (verbose) {
		console.log(`    Mots-clés source: ${[...keywords1].join(', ')}`);
		console.log(`    Mots-clés cible:  ${[...keywords2].join(', ')}`);
		console.log(`    Mots communs:     ${[...common].join(', ')}`);
		console.log(`    Score Jaccard:    ${baseScore.toFixed(3)}, bonus: ${bonus.toFixed(3)}`);
	}

	return { score: finalScore, keywords1, keywords2, common };
}

// ============================================================
// Fonctions d'extraction de texte
// ============================================================

/**
 * Extrait le texte brut depuis la réponse Légifrance
 */
function extractTextFromResponse(response: LegiTexteResponse): string {
	const parts: string[] = [];

	// Ajouter le visa si présent
	if (response.visa) {
		const visaClean = cleanHtml(response.visa);
		if (visaClean) parts.push(visaClean);
	}

	// Extraire les articles
	if (response.articles && response.articles.length > 0) {
		for (const article of response.articles) {
			const num = article.num ? `Article ${article.num}` : '';
			const content = cleanHtml(article.content || article.texteHtml || '');
			if (content) {
				parts.push(num ? `${num}\n${content}` : content);
			}
		}
	}

	// Extraire les sections récursivement
	if (response.sections && response.sections.length > 0) {
		parts.push(extractSections(response.sections));
	}

	// Ajouter les signataires si présents
	if (response.signers) {
		const signersClean = cleanHtml(response.signers);
		if (signersClean) parts.push(`\n---\n${signersClean}`);
	}

	return parts.filter(Boolean).join('\n\n');
}

/**
 * Extrait le texte des sections récursivement
 */
function extractSections(
	sections: Array<{ titre?: string; articles?: Array<{ num?: string; content?: string; texteHtml?: string }>; sections?: typeof sections }>
): string {
	const parts: string[] = [];

	for (const section of sections) {
		if (section.titre) {
			parts.push(`\n## ${section.titre}\n`);
		}

		if (section.articles) {
			for (const article of section.articles) {
				const num = article.num ? `Article ${article.num}` : '';
				const content = cleanHtml(article.content || article.texteHtml || '');
				if (content) {
					parts.push(num ? `${num}\n${content}` : content);
				}
			}
		}

		if (section.sections) {
			parts.push(extractSections(section.sections));
		}
	}

	return parts.filter(Boolean).join('\n\n');
}

/**
 * Nettoie le HTML et décode les entités
 */
function cleanHtml(html: string): string {
	return (
		html
			// Balises de structure
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<p[^>]*>/gi, '\n')
			.replace(/<\/p>/gi, '\n')
			.replace(/<[^>]*>/g, '')
			// Entités HTML nommées courantes
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&laquo;/g, '«')
			.replace(/&raquo;/g, '»')
			.replace(/&ndash;/g, '–')
			.replace(/&mdash;/g, '—')
			.replace(/&hellip;/g, '…')
			.replace(/&euro;/g, '€')
			.replace(/&oelig;/g, 'œ')
			.replace(/&OElig;/g, 'Œ')
			// Entités numériques (décimales et hexadécimales)
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
			.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
			// Nettoyage final
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}

// ============================================================
// Fonctions de base de données
// ============================================================

/**
 * Récupère les dossiers législatifs sans description
 * @param limit - Nombre max de résultats
 * @param withScrutins - Si true, cible les lois liées aux scrutins
 */
async function getLawsToEnrich(limit: number, withScrutins: boolean) {
	if (withScrutins) {
		// Lois liées aux scrutins, sans description
		const results = await db
			.selectDistinct({
				id: laws.id,
				title: laws.title,
				status: laws.status,
				promulgationDate: laws.promulgationDate
			})
			.from(laws)
			.innerJoin(scrutins, eq(scrutins.lawId, laws.id))
			.where(isNull(laws.description))
			.limit(limit);

		return results;
	}

	// Mode par défaut: lois promulguées sans description
	const results = await db
		.select({
			id: laws.id,
			title: laws.title,
			status: laws.status,
			promulgationDate: laws.promulgationDate
		})
		.from(laws)
		.where(
			and(
				eq(laws.status, 'promulgué'),
				isNull(laws.description)
			)
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
	if (args.verbose) {
		console.log('  Mode verbeux activé');
	}
	console.log('');

	// Récupérer les dossiers à enrichir
	const targetDesc = args.withScrutins ? 'liés aux scrutins' : 'promulgués';
	console.log(`Recherche des dossiers ${targetDesc} sans texte complet...`);
	const lawsToEnrich = await getLawsToEnrich(args.limit, args.withScrutins);
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
					console.log(
						`  → Score insuffisant: ${match.score.toFixed(3)} < ${args.threshold}`
					);
					console.log(`    Meilleur candidat: ${match.legifranceTitle?.slice(0, 60)}...`);
					result.lowScore++;
				} else {
					console.log('  → Aucune correspondance trouvée');
					result.notFound++;
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

	process.exit(result.errors > 0 ? 1 : 0);
}

main();
