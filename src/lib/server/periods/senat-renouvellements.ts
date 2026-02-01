/**
 * Gestion des renouvellements du Sénat
 * Le Sénat se renouvelle par moitié tous les 3 ans (séries 1 et 2)
 *
 * Les renouvellements sont extraits dynamiquement depuis les mandats des sénateurs
 * pour éviter tout hardcoding et permettre l'ajout automatique de nouveaux renouvellements.
 */

import { db, mandates, actors } from '$lib/server/db';
import { sql, eq, and, desc } from 'drizzle-orm';

export interface Renouvellement {
	value: string;
	label: string;
	startDate: string;
	endDate: string | null;
}

// Cache pour éviter de requêter la DB à chaque requête
let cachedRenouvellements: Renouvellement[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

/**
 * Récupère les renouvellements disponibles depuis la base de données
 * Les renouvellements sont détectés en analysant les années de début des mandats de sénateur
 */
export async function getRenouvellements(): Promise<Renouvellement[]> {
	if (cachedRenouvellements && Date.now() - cacheTimestamp < CACHE_DURATION) {
		return cachedRenouvellements;
	}

	// Extraire les années de début des mandats de sénateur
	// Regrouper par année pour identifier les renouvellements
	const result = await db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${mandates.startDate})::int`,
			minDate: sql<string>`MIN(${mandates.startDate})`,
			maxEndDate: sql<string>`MAX(${mandates.endDate})`
		})
		.from(mandates)
		.innerJoin(actors, eq(mandates.actorId, actors.id))
		.where(and(eq(actors.chamber, 'SENAT'), eq(mandates.type, 'senateur')))
		.groupBy(sql`EXTRACT(YEAR FROM ${mandates.startDate})`)
		.having(sql`COUNT(*) >= 70`) // Au moins 70 mandats pour être considéré comme un renouvellement (environ 1/4 des sénateurs)
		.orderBy(desc(sql`EXTRACT(YEAR FROM ${mandates.startDate})`));

	// Déterminer l'année courante pour marquer le renouvellement actuel
	const currentYear = new Date().getFullYear();

	cachedRenouvellements = result.map((r, index) => {
		const isCurrentRenouvellement = index === 0;
		const endDate = isCurrentRenouvellement ? null : r.maxEndDate;

		return {
			value: String(r.year),
			label: `${r.year}${isCurrentRenouvellement ? ' (en cours)' : ''}`,
			startDate: r.minDate,
			endDate
		};
	});

	cacheTimestamp = Date.now();
	return cachedRenouvellements;
}

/**
 * Récupère le renouvellement actuel (le plus récent)
 */
export async function getCurrentRenouvellement(): Promise<string> {
	const renouvellements = await getRenouvellements();
	return renouvellements[0]?.value || String(new Date().getFullYear());
}

/**
 * Vérifie si une valeur est un renouvellement valide
 */
export async function isValidRenouvellement(value: string | null): Promise<boolean> {
	if (value === null) return true;
	const renouvellements = await getRenouvellements();
	return renouvellements.some((r) => r.value === value);
}

/**
 * Récupère les dates d'un renouvellement
 */
export async function getRenouvellementDates(
	renouvellement: string
): Promise<{ start: string; end: string | null } | null> {
	const renouvellements = await getRenouvellements();
	const r = renouvellements.find((r) => r.value === renouvellement);
	if (!r) return null;
	return { start: r.startDate, end: r.endDate };
}
