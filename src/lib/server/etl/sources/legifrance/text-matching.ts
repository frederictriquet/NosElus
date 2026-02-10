/**
 * Utilitaires de matching de textes de loi Légifrance
 *
 * Normalisation, extraction de mots-clés, similarité Jaccard,
 * et extraction de texte depuis les réponses API.
 */

import type { LegiTexteResponse } from './client';

// ============================================================
// Configuration
// ============================================================

/** Limite de taille pour le champ description en base (50KB) */
export const MAX_DESCRIPTION_LENGTH = 50000;

export const STOP_WORDS = new Set([
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

// ============================================================
// Fonctions de normalisation et similarité
// ============================================================

/**
 * Normalise un texte pour le matching : minuscules, sans accents, sans ponctuation.
 *
 * @param text - Texte à normaliser
 * @returns Texte normalisé (minuscules, sans accents ni ponctuation, espaces normalisés)
 *
 * @example
 * ```typescript
 * normalize("L'Éducation Nationale"); // "l education nationale"
 * normalize("Loi n°2025-123");        // "loi n 2025 123"
 * ```
 */
export function normalize(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Supprime les accents
		.replace(/[^a-z0-9\s]/g, ' ') // Garde lettres, chiffres, espaces
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Extrait les mots-clés significatifs d'un titre en filtrant les stop words.
 *
 * Garde uniquement les mots de plus de 3 lettres, excluant les stop words français
 * et les nombres purs (sauf les années 20XX).
 *
 * @param title - Titre à analyser
 * @returns Ensemble de mots-clés significatifs (normalisés)
 *
 * @example
 * ```typescript
 * extractKeywords("Loi de finances pour 2025");
 * // Set { "finances", "2025" }
 * // "loi", "de", "pour" sont des stop words
 * ```
 */
export function extractKeywords(title: string): Set<string> {
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
 * Calcule le coefficient de Jaccard entre deux ensembles de mots-clés.
 *
 * Formule : J(A, B) = |A ∩ B| / |A ∪ B|
 * - 0.0 = aucun mot en commun
 * - 1.0 = ensembles identiques
 *
 * @param set1 - Premier ensemble de mots-clés
 * @param set2 - Deuxième ensemble de mots-clés
 * @returns Score de similarité entre 0.0 et 1.0
 *
 * @example
 * ```typescript
 * const s1 = new Set(['loi', 'finances', '2025']);
 * const s2 = new Set(['loi', 'finances', '2024']);
 * jaccardSimilarity(s1, s2); // 0.5 (2 communs / 4 distincts)
 * ```
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
	if (set1.size === 0 && set2.size === 0) return 0;

	const intersection = new Set([...set1].filter((x) => set2.has(x)));
	const union = new Set([...set1, ...set2]);

	return intersection.size / union.size;
}

/**
 * Calcule un score de similarité entre deux titres avec bonus pour mots discriminants.
 *
 * Combine le coefficient de Jaccard avec des bonus pour :
 * - Mots longs (8+ caractères) : +5% par mot
 * - Années (20XX) : +10% par année
 *
 * Score final plafonné à 1.0.
 *
 * @param title1 - Premier titre à comparer
 * @param title2 - Deuxième titre à comparer
 * @param verbose - Si true, affiche les détails du matching dans la console
 * @returns Objet avec score final, mots-clés extraits et mots communs
 *
 * @example
 * ```typescript
 * const result = calculateSimilarity(
 *   "Loi de finances pour 2025",
 *   "Loi finances 2025"
 * );
 * // result.score = 1.0 (Jaccard 1.0)
 * // result.keywords1 = Set { "finances", "2025" }
 * // result.keywords2 = Set { "finances", "2025" }
 * // result.common = Set { "finances", "2025" }
 * ```
 *
 * @see {@link jaccardSimilarity} pour la similarité de base
 * @see {@link extractKeywords} pour l'extraction de mots-clés
 */
export function calculateSimilarity(
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
 * Extrait le texte complet depuis la réponse API Légifrance.
 *
 * Récupère et concatène dans l'ordre :
 * 1. Visa (considérants)
 * 2. Articles (numérotés avec contenu)
 * 3. Sections (hiérarchie récursive)
 * 4. Signataires
 *
 * Le HTML est nettoyé (balises supprimées, entités décodées).
 *
 * @param response - Réponse de l'API `/consult/legiPart`
 * @returns Texte complet formaté en plain text
 *
 * @example
 * ```typescript
 * const response = await client.getTexteComplet('LEGITEXT000123');
 * const fullText = extractTextFromResponse(response);
 * // "Article 1er\nLe code...\n\nArticle 2\n..."
 * ```
 *
 * @see {@link cleanHtml} pour le nettoyage HTML
 * @see {@link extractSections} pour l'extraction des sections
 */
export function extractTextFromResponse(response: LegiTexteResponse): string {
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
export function extractSections(
	sections: Array<{
		titre?: string;
		articles?: Array<{ num?: string; content?: string; texteHtml?: string }>;
		sections?: typeof sections;
	}>
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
export function cleanHtml(html: string): string {
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
			.replace(/&laquo;/g, '\u00AB')
			.replace(/&raquo;/g, '\u00BB')
			.replace(/&ndash;/g, '\u2013')
			.replace(/&mdash;/g, '\u2014')
			.replace(/&hellip;/g, '\u2026')
			.replace(/&euro;/g, '\u20AC')
			.replace(/&oelig;/g, '\u0153')
			.replace(/&OElig;/g, '\u0152')
			// Entités numériques (décimales et hexadécimales)
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
			.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
			// Nettoyage final
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}
