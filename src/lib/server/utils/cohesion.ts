/**
 * Calculate group cohesion from vote data.
 * Cohesion = percentage of votes aligned with the majority position per scrutin.
 */

interface ScrutinVotes {
	scrutinId: string;
	month: string;
	pour: number;
	contre: number;
	abstention: number;
	total: number;
}

interface CohesionData {
	month: string;
	cohesion: number;
	scrutinCount: number;
}

/**
 * Calculate monthly cohesion from per-scrutin vote data.
 * For each scrutin, cohesion = max(pour, contre, abstention) / total * 100
 * Then average by month.
 */
export function calculateMonthlyCohesion(votesByScrutin: ScrutinVotes[]): CohesionData[] {
	// Calculate cohesion per scrutin
	const scrutinCohesion = votesByScrutin.map((s) => ({
		month: s.month,
		cohesion: s.total > 0 ? (Math.max(s.pour, s.contre, s.abstention) / s.total) * 100 : 0
	}));

	// Aggregate by month: average cohesion and count of scrutins
	const byMonth = new Map<string, { sum: number; count: number }>();
	for (const s of scrutinCohesion) {
		const existing = byMonth.get(s.month) || { sum: 0, count: 0 };
		existing.sum += s.cohesion;
		existing.count += 1;
		byMonth.set(s.month, existing);
	}

	return Array.from(byMonth.entries())
		.map(([month, data]) => ({
			month,
			cohesion: data.sum / data.count,
			scrutinCount: data.count
		}))
		.sort((a, b) => a.month.localeCompare(b.month));
}
