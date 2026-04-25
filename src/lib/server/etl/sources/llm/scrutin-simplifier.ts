/**
 * Génère un titre simplifié en français courant pour les scrutins parlementaires
 * à partir de leur titre juridique, via la CLI Claude.
 *
 * Prérequis:
 *   - CLI Claude installée et connectée (claude --version)
 */

import { db } from '../../../db';
import { scrutins } from '../../../db/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { callClaude } from './claude-cli';

type Scrutin = InferSelectModel<typeof scrutins>;

/**
 * Construit le prompt de simplification pour un scrutin.
 * Le contexte système est inclus directement dans le prompt.
 *
 * @param title - Titre juridique du scrutin
 * @param category - Catégorie du scrutin (vote-final, amendement, article…)
 */
export function buildPrompt(title: string, category: string | null): string {
	const categoryHint = category ? ` [type: ${category}]` : '';

	return `Tu es un expert en communication politique française.
Tu reformules des titres de scrutins parlementaires en langage courant pour le grand public.
Réponds UNIQUEMENT avec un objet JSON, rien d'autre.

TITRE DE SCRUTIN PARLEMENTAIRE${categoryHint}:
"""
${title}
"""

TÂCHE: Reformule ce titre en français courant, compréhensible par n'importe quel citoyen.

FORMAT OBLIGATOIRE (remplace les ... par ton résultat):
{"titre": "..."}

RÈGLES:
- 5 à 12 mots maximum
- Pas de jargon juridique ni parlementaire (pas de "PPL", "PLF", "première lecture", "alinéa"…)
- Commence par le sujet principal (ex: "Augmenter le SMIC", "Réforme des retraites"…)
- Utilise des mots simples du quotidien

EXEMPLES:
- "l'ensemble de la proposition de loi visant à augmenter le salaire minimum à 1500€ net" → {"titre": "Augmenter le SMIC à 1500€ net"}
- "l'article 2 du projet de loi de financement de la sécurité sociale pour 2024 (première lecture)" → {"titre": "Financement de la sécurité sociale 2024"}
- "la motion de censure déposée par les groupes de la NUPES" → {"titre": "Motion de censure de la NUPES"}

TON JSON:`;
}

/**
 * Parse la réponse JSON du LLM et extrait le titre simplifié.
 * Tronque à 300 chars si nécessaire (limite varchar DB).
 *
 * @param rawText - Réponse brute du LLM
 * @returns Titre simplifié, ou null si parsing échoue
 */
export function parseSimplifiedTitle(rawText: string): string | null {
	try {
		const start = rawText.indexOf('{');
		const end = rawText.lastIndexOf('}') + 1;

		if (start < 0 || end <= start) {
			console.error(`  [Parse] Aucun JSON trouvé: ${rawText.slice(0, 100)}`);
			return null;
		}

		let jsonStr = rawText.slice(start, end);
		// Supprime les virgules pendantes avant } ou ]
		jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
		const data = JSON.parse(jsonStr);

		const titre = data.titre || data.title || data.titre_simple;
		if (!titre || typeof titre !== 'string' || titre.trim().length === 0) {
			console.error(`  [Parse] Clé "titre" absente ou vide: ${JSON.stringify(data).slice(0, 200)}`);
			return null;
		}

		// Tronque à 300 chars (limite du champ varchar DB)
		return titre.trim().slice(0, 300);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Erreur inconnue';
		console.error(`  [Parse] Erreur JSON: ${message} — brut: ${rawText.slice(0, 100)}`);
		return null;
	}
}

/**
 * Appelle la CLI Claude pour générer un titre simplifié pour un scrutin.
 *
 * @param scrutin - Scrutin à simplifier
 * @returns Titre simplifié ou null si parsing échoue
 */
export async function simplifyScrutinTitle(
	scrutin: Pick<Scrutin, 'id' | 'title' | 'category'>
): Promise<string | null> {
	const prompt = buildPrompt(scrutin.title, scrutin.category);
	const raw = await callClaude(prompt);
	return parseSimplifiedTitle(raw);
}

/**
 * Met à jour `title_simple` pour un scrutin en base.
 *
 * @param scrutinId - ID du scrutin à mettre à jour
 * @param titleSimple - Titre simplifié généré par le LLM
 */
export async function saveScrutinTitleSimple(
	scrutinId: string,
	titleSimple: string
): Promise<void> {
	await db.update(scrutins).set({ titleSimple }).where(eq(scrutins.id, scrutinId));
}

export interface GetUnsimplifiedOptions {
	limit?: number;
	category?: string;
	legislature?: string;
}

/**
 * Récupère les scrutins sans `title_simple`.
 * Filtre optionnel par catégorie et/ou législature.
 * Priorité aux scrutins avec le plus de votants (scrutins emblématiques en premier).
 *
 * @param options - Filtres et limite
 * @returns Liste des scrutins sans titre simplifié
 */
export async function getUnsimplifiedScrutins(
	options: GetUnsimplifiedOptions = {}
): Promise<Pick<Scrutin, 'id' | 'title' | 'category' | 'legislature'>[]> {
	const { limit = 100, category, legislature } = options;

	const conditions = [isNull(scrutins.titleSimple)];

	if (category) {
		conditions.push(eq(scrutins.category, category));
	}
	if (legislature) {
		conditions.push(eq(scrutins.legislature, legislature));
	}

	return db
		.select({
			id: scrutins.id,
			title: scrutins.title,
			category: scrutins.category,
			legislature: scrutins.legislature
		})
		.from(scrutins)
		.where(and(...conditions))
		.orderBy(sql`${scrutins.totalVoters} DESC NULLS LAST`)
		.limit(limit);
}

export interface SimplifyBatchResult {
	total: number;
	success: number;
	errors: number;
	skipped: number;
}

export interface SimplifyBatchOptions {
	limit?: number;
	category?: string;
	legislature?: string;
	dryRun?: boolean;
}

/**
 * Génère `title_simple` pour un batch de scrutins via LLM.
 * Idempotent : ne touche pas les scrutins ayant déjà un `title_simple`.
 *
 * @param options - Configuration du batch
 * @returns Résumé du traitement
 */
export async function simplifyScrutinsBatch(
	options: SimplifyBatchOptions = {}
): Promise<SimplifyBatchResult> {
	const { limit = 100, category, legislature, dryRun = false } = options;

	const scrutinsToProcess = await getUnsimplifiedScrutins({ limit, category, legislature });

	const result: SimplifyBatchResult = {
		total: scrutinsToProcess.length,
		success: 0,
		errors: 0,
		skipped: 0
	};

	console.log(`${scrutinsToProcess.length} scrutins à traiter`);

	for (let i = 0; i < scrutinsToProcess.length; i++) {
		const scrutin = scrutinsToProcess[i];
		const progress = `[${i + 1}/${scrutinsToProcess.length}]`;

		console.log(`${progress} ${scrutin.id} — ${scrutin.title.slice(0, 60)}...`);

		if (dryRun) {
			console.log(`  → [DRY RUN] ignoré`);
			result.skipped++;
			continue;
		}

		try {
			const titleSimple = await simplifyScrutinTitle(scrutin);

			if (!titleSimple) {
				console.log(`  → Erreur: titre non généré`);
				result.errors++;
				continue;
			}

			await saveScrutinTitleSimple(scrutin.id, titleSimple);
			console.log(`  → "${titleSimple}"`);
			result.success++;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur inconnue';
			console.log(`  → Erreur: ${message}`);
			result.errors++;
		}
	}

	return result;
}
