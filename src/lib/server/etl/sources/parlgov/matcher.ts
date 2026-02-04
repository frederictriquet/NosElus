/**
 * Matcher Fuzzy Jaccard pour associer les groupes NosElus aux partis ParlGov
 *
 * Implémente le pattern Jaccard avec normalisation NLP.
 * @see pattern-jaccard-title-matching.md
 */

import type { Organ } from '$lib/server/db';
import type { ParlGovParty, MatchResult, MatchField, MatcherConfig } from './types';
import { FAMILY_POSITIONS, NI_IDENTIFIERS } from './types';

/** Seuil de similarité par défaut (40%) */
const DEFAULT_THRESHOLD = 0.4;

/** Bonus pour mots longs en commun */
const DEFAULT_LONG_WORD_BONUS = 0.2;

/** Longueur minimum pour un mot long */
const DEFAULT_LONG_WORD_MIN_LENGTH = 8;

/**
 * Stop words français à ignorer lors du matching
 */
const FRENCH_STOP_WORDS = new Set([
	'le',
	'la',
	'les',
	'un',
	'une',
	'des',
	'du',
	'de',
	'à',
	'au',
	'aux',
	'et',
	'ou',
	'pour',
	'par',
	'dans',
	'sur',
	'avec',
	'sans',
	'sous',
	'en',
	'ce',
	'cette',
	'ces',
	'son',
	'sa',
	'ses',
	'leur',
	'leurs',
	'mon',
	'ma',
	'mes',
	'groupe',
	'parti',
	'mouvement',
	'union',
	'rassemblement',
	'front',
	'alliance'
]);

/**
 * Normalise un texte pour le matching
 * - Lowercase
 * - Supprime les accents
 * - Supprime la ponctuation
 * - Supprime les stop words
 *
 * @param text - Texte à normaliser
 * @returns Texte normalisé
 */
export function normalizeForMatching(text: string): string {
	return (
		text
			// 1. Lowercase
			.toLowerCase()
			// 2. Supprimer accents (NFD + remove diacritics)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			// 3. Remplacer apostrophes par espaces
			.replace(/['']/g, ' ')
			// 4. Supprimer ponctuation (garder lettres, chiffres, espaces)
			.replace(/[^\w\s]/g, ' ')
			// 5. Normaliser espaces multiples
			.replace(/\s+/g, ' ')
			.trim()
			// 6. Supprimer stop words
			.split(/\s+/)
			.filter((word) => word.length > 1 && !FRENCH_STOP_WORDS.has(word))
			.join(' ')
	);
}

/**
 * Calcule la similarité de Jaccard entre deux chaînes
 * avec bonus pour mots longs discriminants
 *
 * @param s1 - Première chaîne
 * @param s2 - Deuxième chaîne
 * @param config - Configuration optionnelle
 * @returns Score entre 0.0 et 1.0
 */
export function calculateJaccardSimilarity(
	s1: string,
	s2: string,
	config?: MatcherConfig
): number {
	const longWordBonus = config?.longWordBonus ?? DEFAULT_LONG_WORD_BONUS;
	const longWordMinLength = config?.longWordMinLength ?? DEFAULT_LONG_WORD_MIN_LENGTH;

	// Normaliser les deux chaînes
	const normalized1 = normalizeForMatching(s1);
	const normalized2 = normalizeForMatching(s2);

	// Si l'une des chaînes est vide après normalisation
	if (!normalized1 || !normalized2) {
		return 0;
	}

	// Tokeniser en ensembles de mots
	const tokens1 = new Set(normalized1.split(/\s+/).filter((t) => t.length > 0));
	const tokens2 = new Set(normalized2.split(/\s+/).filter((t) => t.length > 0));

	// Calculer intersection et union
	const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
	const union = new Set([...tokens1, ...tokens2]);

	// Jaccard de base
	if (union.size === 0) {
		return 0;
	}
	const baseScore = intersection.size / union.size;

	// Bonus pour mots longs (discriminants)
	let bonus = 0;
	const longWords = [...intersection].filter((t) => t.length >= longWordMinLength);
	if (longWords.length > 0) {
		bonus += longWordBonus;
	}

	return Math.min(baseScore + bonus, 1.0);
}

/**
 * Trouve le meilleur match ParlGov pour un organ NosElus
 *
 * Essaie de matcher sur plusieurs champs dans l'ordre :
 * 1. shortName vs shortName
 * 2. name vs nameNative
 * 3. name vs nameEnglish
 *
 * @param organ - Groupe NosElus à matcher
 * @param parlGovParties - Liste des partis ParlGov
 * @param config - Configuration optionnelle
 * @returns Meilleur match ou null si aucun au-dessus du seuil
 */
export function findBestMatch(
	organ: Organ,
	parlGovParties: ParlGovParty[],
	config?: MatcherConfig
): MatchResult | null {
	const threshold = config?.threshold ?? DEFAULT_THRESHOLD;

	// Vérifier si c'est un groupe NI (pas de matching)
	if (isNonInscrit(organ)) {
		return null;
	}

	let bestMatch: MatchResult | null = null;
	let bestScore = 0;

	for (const party of parlGovParties) {
		// 1. Essayer shortName vs shortName
		if (organ.shortName && party.shortName) {
			const score = calculateJaccardSimilarity(organ.shortName, party.shortName, config);
			if (score > bestScore) {
				bestScore = score;
				bestMatch = createMatchResult(organ, party, score, 'shortName');
			}
		}

		// 2. Essayer name vs nameNative
		if (party.nameNative) {
			const score = calculateJaccardSimilarity(organ.name, party.nameNative, config);
			if (score > bestScore) {
				bestScore = score;
				bestMatch = createMatchResult(organ, party, score, 'nameNative');
			}
		}

		// 3. Essayer name vs nameEnglish
		if (party.nameEnglish) {
			const score = calculateJaccardSimilarity(organ.name, party.nameEnglish, config);
			if (score > bestScore) {
				bestScore = score;
				bestMatch = createMatchResult(organ, party, score, 'nameEnglish');
			}
		}

		// 4. Essayer shortName vs nameNative (cas de noms courts différents)
		if (organ.shortName && party.nameNative) {
			const score = calculateJaccardSimilarity(organ.shortName, party.nameNative, config);
			if (score > bestScore) {
				bestScore = score;
				bestMatch = createMatchResult(organ, party, score, 'nameNative');
			}
		}
	}

	// Retourner uniquement si au-dessus du seuil
	if (bestMatch && bestScore >= threshold) {
		return bestMatch;
	}

	return null;
}

/**
 * Crée un objet MatchResult
 */
function createMatchResult(
	organ: Organ,
	party: ParlGovParty,
	score: number,
	matchedOn: MatchField
): MatchResult {
	return {
		organId: organ.id,
		organName: organ.name,
		organShortName: organ.shortName,
		parlGovParty: party,
		score,
		matchedOn
	};
}

/**
 * Vérifie si un organ est un groupe "Non-inscrit"
 */
export function isNonInscrit(organ: Organ): boolean {
	const name = organ.name.toLowerCase();
	const shortName = organ.shortName?.toLowerCase() || '';

	for (const ni of NI_IDENTIFIERS) {
		const niLower = ni.toLowerCase();
		if (name.includes(niLower) || shortName === niLower) {
			return true;
		}
	}

	return false;
}

/**
 * Détermine la position politique d'un organ
 *
 * Priorité :
 * 1. Match ParlGov (si trouvé)
 * 2. Non-inscrit → 999
 * 3. Famille politique (fallback)
 * 4. Centre par défaut (5.0)
 *
 * @param organ - Groupe NosElus
 * @param match - Résultat du matching (ou null)
 * @returns Position sur l'échiquier (0-10, ou 999 pour NI)
 */
export function determinePosition(organ: Organ, match: MatchResult | null): number {
	// 1. Si match trouvé avec position
	if (match && match.parlGovParty.leftRight !== null) {
		return match.parlGovParty.leftRight;
	}

	// 2. Non-inscrit → fin de liste
	if (isNonInscrit(organ)) {
		return 999;
	}

	// 3. Fallback sur famille politique (si match sans position L/R)
	if (match && match.parlGovParty.familyShort) {
		const familyPosition = FAMILY_POSITIONS[match.parlGovParty.familyShort];
		if (familyPosition !== undefined) {
			return familyPosition;
		}
	}

	// 4. Centre par défaut
	return 5.0;
}

/**
 * Matche tous les organs avec les partis ParlGov
 *
 * @param organs - Liste des groupes NosElus
 * @param parlGovParties - Liste des partis ParlGov
 * @param config - Configuration optionnelle
 * @returns Liste des résultats de matching
 */
export function matchAll(
	organs: Organ[],
	parlGovParties: ParlGovParty[],
	config?: MatcherConfig
): { matched: MatchResult[]; notMatched: Organ[] } {
	const matched: MatchResult[] = [];
	const notMatched: Organ[] = [];

	for (const organ of organs) {
		const match = findBestMatch(organ, parlGovParties, config);
		if (match) {
			matched.push(match);
		} else {
			notMatched.push(organ);
		}
	}

	return { matched, notMatched };
}
