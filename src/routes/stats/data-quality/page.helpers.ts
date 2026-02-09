/**
 * Format legislature label selon la chambre
 * 17 → "17e législature"
 * PE-10 → "10e terme"
 * SE-2023 → "Renouvellement 2023"
 */
export function formatLegislature(legislature: string): string {
	if (legislature.startsWith('PE-')) {
		const num = legislature.replace('PE-', '');
		return `${num}e terme`;
	}
	if (legislature.startsWith('SE-')) {
		const num = legislature.replace('SE-', '');
		return `Renouvellement ${num}`;
	}
	return `${legislature}e législature`;
}

/**
 * Calcule le pourcentage
 */
export function percentage(value: number, total: number): number {
	return total > 0 ? (value / total) * 100 : 0;
}

/**
 * Classe CSS selon le taux de couverture
 * >75% → coverage-high (vert)
 * 25-75% → coverage-medium (orange)
 * <25% → coverage-low (rouge)
 */
export function coverageClass(pct: number): string {
	if (pct > 75) return 'coverage-high';
	if (pct > 25) return 'coverage-medium';
	return 'coverage-low';
}
