/**
 * Gestion des termes du Parlement européen
 * Les termes PE correspondent aux mandatures (5 ans)
 */

export interface Term {
	value: string;
	label: string;
	startDate: string;
	endDate: string | null;
}

// Données statiques des termes PE depuis 2004
const TERM_DATA: Record<number, { start: string; end: string | null }> = {
	6: { start: '2004-07-20', end: '2009-07-13' },
	7: { start: '2009-07-14', end: '2014-06-30' },
	8: { start: '2014-07-01', end: '2019-07-01' },
	9: { start: '2019-07-02', end: '2024-07-15' },
	10: { start: '2024-07-16', end: null }
};

/**
 * Récupère les termes PE disponibles
 */
export function getTerms(): Term[] {
	return Object.entries(TERM_DATA)
		.sort(([a], [b]) => Number(b) - Number(a)) // Tri décroissant
		.map(([num, dates]) => {
			const startYear = new Date(dates.start).getFullYear();
			const endYear = dates.end ? new Date(dates.end).getFullYear() : null;
			const isCurrent = dates.end === null;

			return {
				value: num,
				label: `${num}e (${startYear}${isCurrent ? '-' : `-${endYear}`})`,
				startDate: dates.start,
				endDate: dates.end
			};
		});
}

/**
 * Récupère le terme actuel (le plus récent)
 */
export function getCurrentTerm(): string {
	const terms = getTerms();
	return terms[0]?.value || '10';
}

/**
 * Vérifie si une valeur est un terme valide
 */
export function isValidTerm(value: string | null): boolean {
	if (value === null) return true;
	const terms = getTerms();
	return terms.some((t) => t.value === value);
}

/**
 * Récupère les dates d'un terme
 */
export function getTermDates(term: string): { start: string; end: string | null } | null {
	const numTerm = parseInt(term, 10);
	const dates = TERM_DATA[numTerm];
	if (!dates) return null;
	return { start: dates.start, end: dates.end };
}
