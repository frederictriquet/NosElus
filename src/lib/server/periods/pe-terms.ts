/**
 * Gestion des termes du Parlement européen
 * Les termes PE correspondent aux mandatures (5 ans)
 *
 * Les termes sont extraits dynamiquement depuis les mandats des eurodéputés
 * pour éviter tout hardcoding et permettre l'ajout automatique de nouveaux termes.
 */

import { db, mandates, actors } from '$lib/server/db';
import { sql, eq, and, desc, like } from 'drizzle-orm';

export interface Term {
	value: string;
	label: string;
	startDate: string;
	endDate: string | null;
}

// Cache pour éviter de requêter la DB à chaque requête
let cachedTerms: Term[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

/**
 * Récupère les termes PE disponibles depuis la base de données
 * Les termes sont détectés en analysant les législatures des mandats PE
 */
export async function getTerms(): Promise<Term[]> {
	if (cachedTerms && Date.now() - cacheTimestamp < CACHE_DURATION) {
		return cachedTerms;
	}

	// Extraire les termes depuis les mandats PE (groupes GPEU-*)
	// Le champ legislature contient le numéro du terme pour les mandats PE
	const result = await db
		.select({
			term: mandates.legislature,
			minDate: sql<string>`MIN(${mandates.startDate})`,
			maxEndDate: sql<string>`MAX(${mandates.endDate})`
		})
		.from(mandates)
		.innerJoin(actors, eq(mandates.actorId, actors.id))
		.where(
			and(
				eq(actors.chamber, 'PE'),
				like(mandates.organId, 'GPEU-%'), // Groupes PE uniquement
				sql`${mandates.legislature} IS NOT NULL`
			)
		)
		.groupBy(mandates.legislature)
		.having(sql`COUNT(*) >= 5`) // Au moins 5 mandats pour être considéré comme un terme valide (France ~79 MEPs)
		.orderBy(sql`${mandates.legislature}::int DESC`); // Tri numérique décroissant

	const terms: Term[] = result
		.filter((r): r is typeof r & { term: string } => r.term !== null)
		.map((r, index) => {
			const num = parseInt(r.term, 10);
			const startYear = new Date(r.minDate).getFullYear();
			const endYear = r.maxEndDate ? new Date(r.maxEndDate).getFullYear() : null;
			const isCurrentTerm = index === 0;

			// Format label: "10e (2024-)" for current term, "9e (2019-2024)" for past terms
			let labelYears = `${startYear}`;
			if (isCurrentTerm) {
				labelYears += '-';
			} else if (endYear) {
				labelYears += `-${endYear}`;
			}

			return {
				value: r.term,
				label: `${num}e (${labelYears})`,
				startDate: r.minDate,
				endDate: isCurrentTerm ? null : r.maxEndDate
			};
		});

	cachedTerms = terms;
	cacheTimestamp = Date.now();
	return terms;
}

/**
 * Récupère le terme actuel (le plus récent)
 */
export async function getCurrentTerm(): Promise<string> {
	const terms = await getTerms();
	// Fallback dynamique : année courante si aucun terme trouvé
	return terms[0]?.value || String(Math.floor(new Date().getFullYear() / 5) + 2);
}

/**
 * Vérifie si une valeur est un terme valide
 */
export async function isValidTerm(value: string | null): Promise<boolean> {
	if (value === null) return true;
	const terms = await getTerms();
	return terms.some((t) => t.value === value);
}

/**
 * Récupère les dates d'un terme
 */
export async function getTermDates(term: string): Promise<{ start: string; end: string | null } | null> {
	const terms = await getTerms();
	const t = terms.find((t) => t.value === term);
	if (!t) return null;
	return { start: t.startDate, end: t.endDate };
}
