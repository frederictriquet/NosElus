/**
 * Analyseur de textes de lois utilisant un LLM local via Ollama.
 *
 * Prérequis:
 *   - Ollama installé et lancé (ollama serve)
 *   - Modèle téléchargé (ollama pull mistral-nemo)
 */

import { db } from '../../../db';
import { laws, lawSummaries, lawTags, tags } from '../../../db/schema';
import { eq, isNull, isNotNull, and, desc, asc } from 'drizzle-orm';
import type { Law, NewLawSummary, NewLawTag } from '../../../db/schema';

/**
 * Mapping entre le nom affiché au LLM et le slug DB.
 *
 * Nécessaire car le LLM reçoit des noms accentués lowercase ("économie")
 * mais la DB utilise des slugs ASCII ("economie") comme clés primaires.
 *
 * @interface TagMapping
 */
export interface TagMapping {
	/** Slug ASCII utilisé comme clé primaire DB (ex: "economie") */
	slug: string;
	/** Nom affiché avec accents (ex: "Économie") */
	name: string;
	/** Nom lowercase pour le prompt LLM (ex: "économie") */
	promptName: string;
}

/**
 * Charge les tags disponibles depuis la table `tags` en base de données.
 *
 * Cette fonction remplace l'ancien constant `AVAILABLE_TAGS` hardcodé.
 * Les tags sont chargés dynamiquement pour permettre l'ajout de nouveaux tags
 * sans modifier le code.
 *
 * @returns Liste de mappings tag (slug DB ↔ nom LLM)
 *
 * @example
 * ```typescript
 * const tags = await getAvailableTags();
 * // => [
 * //   { slug: 'economie', name: 'Économie', promptName: 'économie' },
 * //   { slug: 'sante', name: 'Santé', promptName: 'santé' },
 * //   ...
 * // ]
 * ```
 *
 * @see {@link tags} - Table de référence des tags
 */
export async function getAvailableTags(): Promise<TagMapping[]> {
	const dbTags = await db
		.select({ slug: tags.slug, name: tags.name })
		.from(tags)
		.orderBy(asc(tags.name));

	return dbTags.map((t) => ({
		slug: t.slug,
		name: t.name,
		promptName: t.name.toLowerCase()
	}));
}

export interface LawAnalysis {
	summary: string;
	tags: string[]; // slugs DB (ex: "economie", "sante")
	rawResponse?: string;
}

export interface AnalyzerConfig {
	model: string;
	baseUrl: string;
	temperature: number;
	maxTokens: number;
	timeout: number;
}

const DEFAULT_CONFIG: AnalyzerConfig = {
	model: 'mistral-nemo',
	baseUrl: 'http://localhost:11434',
	temperature: 0.3, // Bas pour des réponses cohérentes
	maxTokens: 200,
	timeout: 300000 // 5 minutes (textes de loi complets)
};

const SYSTEM_PROMPT = `Tu es un expert en analyse de textes législatifs français.
Tu dois rendre les lois accessibles au grand public.
Réponds UNIQUEMENT avec un objet JSON, rien d'autre.`;

function buildUserPrompt(
	lawTitle: string,
	lawDescription: string | null,
	tagNames: string[]
): string {
	const text = lawDescription ? `${lawTitle}\n\n${lawDescription}` : lawTitle;

	return `TEXTE DE LOI À ANALYSER:
"""
${text}
"""

TÂCHE: Résume cette loi pour un citoyen non-juriste.

FORMAT OBLIGATOIRE - réponds UNIQUEMENT avec ce JSON (remplace les ... par ton analyse):
{"resume": "...", "tags": ["...", "..."]}

RÈGLES:
- resume: 1-3 phrases simples sur ce que change concrètement cette loi
- tags: 2-4 mots parmi: ${tagNames.join(', ')}

EXEMPLE:
{"resume": "Cette loi augmente le SMIC de 2% pour tous les salariés au salaire minimum.", "tags": ["travail", "économie"]}

TON JSON:`;
}

/**
 * Parse la réponse JSON du modèle LLM.
 *
 * Le LLM retourne des tags avec accents ("économie", "santé") mais la DB
 * utilise des slugs ASCII ("economie", "sante"). Cette fonction effectue
 * la conversion via le mapping fourni.
 *
 * @param rawText - Réponse brute du LLM (peut contenir du texte avant/après le JSON)
 * @param tagMappings - Liste des tags valides avec leurs slugs DB
 * @returns Analyse parsée avec slugs DB (ou erreur si parsing échoue)
 *
 * @example
 * ```typescript
 * const raw = '{"resume": "Cette loi...", "tags": ["économie", "santé"]}';
 * const analysis = parseResponse(raw, tagMappings);
 * // => { summary: "Cette loi...", tags: ["economie", "sante"] }
 * ```
 */
function parseResponse(rawText: string, tagMappings: TagMapping[]): LawAnalysis {
	// Lookup: nom lowercase accentué → slug DB
	const nameToSlug = new Map(tagMappings.map((t) => [t.promptName, t.slug]));

	try {
		// Essaie de trouver le JSON dans la réponse
		const start = rawText.indexOf('{');
		const end = rawText.lastIndexOf('}') + 1;
		if (start >= 0 && end > start) {
			const jsonStr = rawText.slice(start, end);
			const data = JSON.parse(jsonStr);

			// Debug: afficher les clés reçues
			console.log(`  [Parse] Clés JSON reçues: ${Object.keys(data).join(', ')}`);

			// Valide les tags et convertit en slugs DB
			const validTags = (data.tags || [])
				.map((t: string) => nameToSlug.get(t.toLowerCase()))
				.filter((slug: string | undefined): slug is string => slug !== undefined);

			const summary = data.resume || data.summary || data.résumé;
			if (!summary) {
				console.error(`  [Parse] Aucune clé resume/summary/résumé trouvée`);
				console.error(`  [Parse] Contenu: ${JSON.stringify(data).slice(0, 300)}`);
			}

			return {
				summary: summary || 'Résumé non disponible',
				tags: validTags,
				rawResponse: rawText
			};
		} else {
			console.error('  [Parse] Aucun JSON trouvé dans la réponse');
			console.error(
				`  [Parse] Réponse brute (${rawText.length} chars): ${rawText.slice(0, 200)}...`
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erreur inconnue';
		console.error(`  [Parse] Erreur JSON: ${message}`);
		console.error(
			`  [Parse] Réponse brute (${rawText.length} chars): ${rawText.slice(0, 200)}...`
		);
	}

	return {
		summary: 'Erreur: impossible de parser la réponse',
		tags: [],
		rawResponse: rawText
	};
}

/**
 * Analyse une loi avec Ollama (LLM local).
 *
 * Envoie le titre et la description de la loi au modèle LLM qui génère :
 * - Un résumé accessible au grand public (1-3 phrases)
 * - Des tags de catégorisation (2-4 tags parmi ceux disponibles)
 *
 * @param law - Loi à analyser (seuls title et description sont nécessaires)
 * @param config - Configuration Ollama (optionnel, utilise DEFAULT_CONFIG sinon)
 * @param tagMappings - Tags pré-chargés (optionnel, chargés depuis la DB si absent)
 * @returns Analyse avec résumé et tags (slugs DB)
 * @throws {Error} Si Ollama n'est pas accessible ou si le timeout est dépassé
 *
 * @example
 * ```typescript
 * const law = await db.select().from(laws).where(eq(laws.id, 'PRJLANR5L16B001'));
 * const analysis = await analyzeLaw(law[0]);
 * console.log(analysis.summary); // "Cette loi augmente le SMIC..."
 * console.log(analysis.tags);    // ["travail", "economie"]
 * ```
 *
 * @see {@link getAvailableTags} - Charge les tags depuis la DB
 * @see {@link analyzeLawsBatch} - Pour analyser plusieurs lois en parallèle
 */
export async function analyzeLaw(
	law: Pick<Law, 'title' | 'description'>,
	config: Partial<AnalyzerConfig> = {},
	tagMappings?: TagMapping[]
): Promise<LawAnalysis> {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const mappings = tagMappings ?? (await getAvailableTags());
	const tagNames = mappings.map((t) => t.promptName);
	const prompt = buildUserPrompt(law.title, law.description, tagNames);

	const response = await fetch(`${cfg.baseUrl}/api/generate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: cfg.model,
			prompt,
			system: SYSTEM_PROMPT,
			stream: false,
			options: {
				temperature: cfg.temperature,
				num_predict: cfg.maxTokens
			}
		}),
		signal: AbortSignal.timeout(cfg.timeout)
	});

	if (!response.ok) {
		throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as { response: string };
	return parseResponse(data.response.trim(), mappings);
}

/**
 * Récupère les lois qui n'ont pas encore été analysées.
 */
export async function getUnanalyzedLaws(
	limit: number = 100,
	legislature?: string
): Promise<Law[]> {
	const query = db
		.select()
		.from(laws)
		.where(
			and(
				// Seulement les lois avec texte complet
				isNotNull(laws.description),
				// Pas encore analysée
				isNull(
					db
						.select({ lawId: lawSummaries.lawId })
						.from(lawSummaries)
						.where(eq(lawSummaries.lawId, laws.id))
						.limit(1)
				)
			)
		)
		.orderBy(desc(laws.depositDate))
		.limit(limit);

	const results = await query;

	// Filtrer par législature si spécifié (post-query pour simplifier)
	if (legislature) {
		return results.filter((l) => l.legislature === legislature);
	}

	return results;
}

/**
 * Sauvegarde une analyse dans la base de données.
 * Écrit le résumé dans law_summaries et les tags dans law_tags.
 */
export async function saveLawAnalysis(
	lawId: string,
	analysis: LawAnalysis,
	model: string
): Promise<void> {
	const newSummary: NewLawSummary = {
		lawId,
		summary: analysis.summary,
		model,
		analyzedAt: new Date(),
		updatedAt: new Date()
	};

	// Upsert du résumé
	await db
		.insert(lawSummaries)
		.values(newSummary)
		.onConflictDoUpdate({
			target: lawSummaries.lawId,
			set: {
				summary: newSummary.summary,
				model: newSummary.model,
				updatedAt: new Date()
			}
		});

	// Supprimer les anciens tags et insérer les nouveaux
	await db.delete(lawTags).where(eq(lawTags.lawId, lawId));

	if (analysis.tags.length > 0) {
		const tagValues: NewLawTag[] = analysis.tags.map((tag) => ({
			lawId,
			tagSlug: tag
		}));

		await db.insert(lawTags).values(tagValues);
	}
}

export interface AnalyzeBatchResult {
	total: number;
	success: number;
	errors: number;
	skipped: number;
}

/**
 * Analyse un batch de lois.
 * Charge les tags une seule fois depuis la DB pour tout le batch.
 */
export async function analyzeLawsBatch(
	options: {
		limit?: number;
		legislature?: string;
		model?: string;
		dryRun?: boolean;
	} = {}
): Promise<AnalyzeBatchResult> {
	const { limit = 100, legislature, model = 'mistral', dryRun = false } = options;

	const [lawsToAnalyze, tagMappings] = await Promise.all([
		getUnanalyzedLaws(limit, legislature),
		getAvailableTags()
	]);

	const result: AnalyzeBatchResult = {
		total: lawsToAnalyze.length,
		success: 0,
		errors: 0,
		skipped: 0
	};

	console.log(`Found ${lawsToAnalyze.length} laws to analyze`);
	console.log(`Tags disponibles: ${tagMappings.map((t) => t.promptName).join(', ')}`);

	for (let i = 0; i < lawsToAnalyze.length; i++) {
		const law = lawsToAnalyze[i];
		const progress = `[${i + 1}/${lawsToAnalyze.length}]`;

		try {
			console.log(`${progress} Analyzing: ${law.id} - ${law.title.slice(0, 50)}...`);

			if (dryRun) {
				console.log(`  → [DRY RUN] Would analyze this law`);
				result.skipped++;
				continue;
			}

			const analysis = await analyzeLaw(law, { model }, tagMappings);

			if (analysis.summary.startsWith('Erreur:')) {
				console.log(`  → Error: ${analysis.summary}`);
				result.errors++;
				continue;
			}

			await saveLawAnalysis(law.id, analysis, model);

			console.log(`  → Summary: ${analysis.summary.slice(0, 60)}...`);
			console.log(`  → Tags: ${analysis.tags.join(', ')}`);
			result.success++;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.log(`  → Error: ${message}`);
			result.errors++;
		}
	}

	return result;
}
