/**
 * Gestion des renouvellements du Sénat
 * Le Sénat se renouvelle par moitié tous les 3 ans (séries 1 et 2)
 */

export interface Renouvellement {
	value: string;
	label: string;
	startDate: string;
	endDate: string | null;
}

// Années de renouvellement avec leurs périodes
// Les sénateurs sont élus pour 6 ans
const RENOUVELLEMENTS: Array<{ year: number; start: string; end: string | null }> = [
	{ year: 2023, start: '2023-10-01', end: null },
	{ year: 2020, start: '2020-09-27', end: '2026-09-30' },
	{ year: 2017, start: '2017-09-24', end: '2023-09-30' },
	{ year: 2014, start: '2014-09-28', end: '2020-09-26' },
	{ year: 2011, start: '2011-09-25', end: '2017-09-23' }
];

/**
 * Récupère les renouvellements disponibles
 */
export function getRenouvellements(): Renouvellement[] {
	return RENOUVELLEMENTS.map(({ year, start, end }) => {
		const isCurrent = end === null;

		return {
			value: String(year),
			label: `${year}${isCurrent ? ' (en cours)' : ''}`,
			startDate: start,
			endDate: end
		};
	});
}

/**
 * Récupère le renouvellement actuel (le plus récent)
 */
export function getCurrentRenouvellement(): string {
	const renouvellements = getRenouvellements();
	return renouvellements[0]?.value || '2023';
}

/**
 * Vérifie si une valeur est un renouvellement valide
 */
export function isValidRenouvellement(value: string | null): boolean {
	if (value === null) return true;
	const renouvellements = getRenouvellements();
	return renouvellements.some((r) => r.value === value);
}

/**
 * Récupère les dates d'un renouvellement
 */
export function getRenouvellementDates(
	renouvellement: string
): { start: string; end: string | null } | null {
	const r = RENOUVELLEMENTS.find((r) => String(r.year) === renouvellement);
	if (!r) return null;
	return { start: r.start, end: r.end };
}
