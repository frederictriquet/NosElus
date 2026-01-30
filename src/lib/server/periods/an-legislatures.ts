/**
 * Gestion des législatures de l'Assemblée nationale
 * Données récupérées depuis la base de données
 */

import { db, scrutins } from '$lib/server/db';
import { sql, desc, notLike } from 'drizzle-orm';

export interface Legislature {
	value: string;
	label: string;
	startDate: string;
	endDate: string | null;
}

// Cache pour éviter de requêter la DB à chaque requête
let cachedLegislatures: Legislature[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

/**
 * Récupère les législatures disponibles depuis la base de données
 */
export async function getLegislatures(): Promise<Legislature[]> {
	if (cachedLegislatures && Date.now() - cacheTimestamp < CACHE_DURATION) {
		return cachedLegislatures;
	}

	const result = await db
		.select({
			legislature: scrutins.legislature,
			minDate: sql<string>`min(${scrutins.date})`,
			maxDate: sql<string>`max(${scrutins.date})`
		})
		.from(scrutins)
		// Exclure les scrutins PE (legislature commence par "PE-")
		.where(notLike(scrutins.legislature, 'PE-%'))
		.groupBy(scrutins.legislature)
		.orderBy(sql`${scrutins.legislature}::int DESC`); // Tri numérique décroissant

	cachedLegislatures = result.map((r) => {
		const num = parseInt(r.legislature, 10);
		const startYear = new Date(r.minDate).getFullYear();
		const endYear = r.maxDate ? new Date(r.maxDate).getFullYear() : null;
		const isCurrentLegislature = result[0]?.legislature === r.legislature;

		// Format label: "17e (2024-)" for current legislature, "16e (2022-2024)" for past
		let labelYears = `${startYear}`;
		if (isCurrentLegislature) {
			labelYears += '-';
		} else if (endYear) {
			labelYears += `-${endYear}`;
		}

		return {
			value: r.legislature,
			label: `${num}e (${labelYears})`,
			startDate: r.minDate,
			endDate: isCurrentLegislature ? null : r.maxDate
		};
	});

	cacheTimestamp = Date.now();
	return cachedLegislatures;
}

/**
 * Récupère la législature actuelle (la plus récente)
 */
export async function getCurrentLegislature(): Promise<string> {
	const legislatures = await getLegislatures();
	// Fallback dynamique basé sur l'année courante si aucune législature trouvée
	// Approximation : une législature dure ~5 ans, la 17e a commencé en 2024
	if (legislatures[0]?.value) return legislatures[0].value;
	const currentYear = new Date().getFullYear();
	return String(Math.floor((currentYear - 2002) / 5) + 12);
}

/**
 * Vérifie si une valeur est une législature valide
 */
export async function isValidLegislature(value: string | null): Promise<boolean> {
	if (value === null) return true;
	const legislatures = await getLegislatures();
	return legislatures.some((l) => l.value === value);
}

/**
 * Récupère les dates d'une législature
 */
export async function getLegislatureDates(
	legislature: string
): Promise<{ start: string; end: string | null } | null> {
	const legislatures = await getLegislatures();
	const leg = legislatures.find((l) => l.value === legislature);
	if (!leg) return null;
	return { start: leg.startDate, end: leg.endDate };
}
