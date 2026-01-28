import type { ImportStats } from './types';

export function formatDate(date: Date | string | undefined | null): string | null {
	if (!date) return null;
	if (typeof date === 'string') {
		// Check if already in YYYY-MM-DD format
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
		// Try to parse
		const parsed = new Date(date);
		if (isNaN(parsed.getTime())) return null;
		return parsed.toISOString().split('T')[0];
	}
	return date.toISOString().split('T')[0];
}

export function extractIdFromUid(uid: string): string {
	// UID format: PA123456 -> PA123456
	// or VTANR5A2024-1234 -> VTANR5A2024-1234
	return uid;
}

export function logProgress(stats: ImportStats, entity: string): void {
	console.log(
		`[${entity}] Total: ${stats.total}, Inserted: ${stats.inserted}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`
	);
}

export async function processBatch<T, R>(
	items: T[],
	batchSize: number,
	processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
	const results: R[] = [];
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		const batchResults = await processor(batch);
		results.push(...batchResults);
	}
	return results;
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
