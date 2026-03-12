/**
 * Calcul de verdict pour la page /verifier.
 *
 * Fonctions pures (sans I/O) permettant de :
 * 1. Détecter la direction implicite d'une affirmation (pour/contre/abstention)
 * 2. Calculer un verdict (confirmé/infirmé/nuancé) en comparant la direction
 *    détectée aux votes réels d'un groupe.
 *
 * Approche lexicale : pas de LLM (non disponible en production).
 * Seuil de confiance : ≥ 60% des scrutins confirment → ✅ Confirmé,
 *                      ≥ 60% des scrutins infirment → ❌ Infirmé,
 *                      sinon → 🟡 Nuancé.
 */

import type { GroupVoteResult } from '$lib/server/api/helpers';

// ============================================================
// Types
// ============================================================

export type Direction = 'pour' | 'contre' | 'abstention';

export type Verdict = 'confirmé' | 'infirmé' | 'nuancé';

export interface VerdictResult {
	verdict: Verdict;
	/** Pourcentage de scrutins qui confirment l'affirmation (0-100). */
	confirmPct: number;
	/** Nombre de scrutins pris en compte (groupVote non-null). */
	scrutinCount: number;
}

// ============================================================
// Marqueurs lexicaux
// ============================================================

/** Marqueurs lexicaux indiquant un vote POUR. */
const POUR_MARKERS = [
	'défend',
	'défendent',
	'soutient',
	'soutiennent',
	'vote pour',
	'voté pour',
	'en faveur',
	'favorable',
	'approuve',
	'approuvent',
	'appuie',
	'appuient',
	'adopte',
	'adoptent'
];

/** Marqueurs lexicaux indiquant un vote CONTRE. */
const CONTRE_MARKERS = [
	'contre',
	"s'oppose",
	"s'opposent",
	'oppose',
	'opposent',
	'refuse',
	'refusent',
	'rejette',
	'rejettent',
	'vote contre',
	'voté contre',
	'défavorable',
	'opposé',
	'opposés'
];

/** Marqueurs lexicaux indiquant une ABSTENTION. */
const ABSTENTION_MARKERS = [
	'abstient',
	"s'abstient",
	"s'abstiennent",
	'abstiennent',
	'abstention',
	'abstentions',
	'ne vote pas'
];

/**
 * Vérifie si un marqueur est présent dans un texte en respectant les limites de mots.
 * Utilise un lookbehind/lookahead sur [a-zA-ZÀ-ÿ] pour gérer correctement les caractères
 * accentués (ex: "favorable" ne doit pas matcher dans "défavorable").
 */
function matchesMarker(text: string, marker: string): boolean {
	const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const regex = new RegExp(`(?<![a-zA-ZÀ-ÿ])${escaped}(?![a-zA-ZÀ-ÿ])`, 'i');
	return regex.test(text);
}

// ============================================================
// detectDirection
// ============================================================

/**
 * Analyse une affirmation en langage naturel et extrait la direction de vote implicite.
 *
 * Renvoie 'contre' | 'pour' | 'abstention' | null.
 * En cas d'ambiguïté (pour ET contre détectés), renvoie null.
 *
 * @param query - Affirmation en langage naturel (ex: "Le RN a voté contre le SMIC")
 */
export function detectDirection(query: string): Direction | null {
	const lower = query.toLowerCase();

	const hasPour = POUR_MARKERS.some((m) => matchesMarker(lower, m));
	const hasContre = CONTRE_MARKERS.some((m) => matchesMarker(lower, m));
	const hasAbstention = ABSTENTION_MARKERS.some((m) => matchesMarker(lower, m));

	// Ambiguïté : plusieurs directions détectées → null
	const count = (hasPour ? 1 : 0) + (hasContre ? 1 : 0) + (hasAbstention ? 1 : 0);
	if (count !== 1) return null;

	if (hasPour) return 'pour';
	if (hasContre) return 'contre';
	return 'abstention';
}

// ============================================================
// computeVerdict
// ============================================================

/**
 * Calcule un verdict en comparant une direction attendue aux votes réels d'un groupe.
 *
 * Algorithme :
 * - Filtre les scrutins qui ont un groupVote (données de vote disponibles).
 * - Pour chaque scrutin, détermine si le groupe confirme la direction :
 *   - direction 'contre' + pctContre ≥ 60% → confirme
 *   - direction 'pour'  + pctPour   ≥ 60% → confirme
 *   - direction 'abstention' + pctAbstention ≥ 60% → confirme
 * - Verdict global : si ≥ 60% des scrutins confirment → 'confirmé',
 *   si ≥ 60% infirment (direction opposée ≥ 60%) → 'infirmé',
 *   sinon → 'nuancé'.
 *
 * @param scrutins - Liste de scrutins avec leur vote de groupe (peut être null)
 * @param direction - Direction détectée dans l'affirmation
 *
 * @returns null si aucun scrutin avec données de vote n'est disponible.
 */
export function computeVerdict(
	scrutins: Array<{ groupVote: GroupVoteResult | null }>,
	direction: Direction
): VerdictResult | null {
	const withVote = scrutins.filter((s) => s.groupVote !== null);
	if (withVote.length === 0) return null;

	let confirmedCount = 0;
	let infirmedCount = 0;

	for (const s of withVote) {
		const gv = s.groupVote!;
		const confirms = confirmsByDirection(gv, direction);
		const infirms = infirmsByDirection(gv, direction);
		if (confirms) confirmedCount++;
		else if (infirms) infirmedCount++;
	}

	const total = withVote.length;
	const confirmPct = Math.round((confirmedCount / total) * 100);
	const infirmPct = Math.round((infirmedCount / total) * 100);

	let verdict: Verdict;
	if (confirmPct >= 60) {
		verdict = 'confirmé';
	} else if (infirmPct >= 60) {
		verdict = 'infirmé';
	} else {
		verdict = 'nuancé';
	}

	return { verdict, confirmPct, scrutinCount: total };
}

// ============================================================
// Helpers internes
// ============================================================

const THRESHOLD = 60;

function confirmsByDirection(gv: GroupVoteResult, direction: Direction): boolean {
	if (direction === 'contre') return gv.pctContre >= THRESHOLD;
	if (direction === 'pour') return gv.pctPour >= THRESHOLD;
	return gv.pctAbstention >= THRESHOLD;
}

function infirmsByDirection(gv: GroupVoteResult, direction: Direction): boolean {
	if (direction === 'contre') return gv.pctPour >= THRESHOLD;
	if (direction === 'pour') return gv.pctContre >= THRESHOLD;
	// Pour abstention, infirmé si vote tranché (pour ou contre)
	return gv.pctPour >= THRESHOLD || gv.pctContre >= THRESHOLD;
}
