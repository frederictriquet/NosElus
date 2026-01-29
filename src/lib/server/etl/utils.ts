import type { ImportStats } from './types';
import { db, syncMetadata, type SyncMetadata, type NewSyncMetadata } from '../db';
import { eq } from 'drizzle-orm';

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

// --- Sync Metadata Utils ---

export function buildSyncId(source: string, entityType: string, legislature?: string): string {
	return legislature ? `${source}:${entityType}:${legislature}` : `${source}:${entityType}`;
}

export async function getLastSync(
	source: string,
	entityType: string,
	legislature?: string
): Promise<SyncMetadata | null> {
	const id = buildSyncId(source, entityType, legislature);
	const result = await db.select().from(syncMetadata).where(eq(syncMetadata.id, id)).limit(1);
	return result[0] || null;
}

export async function updateSyncMetadata(
	source: string,
	entityType: string,
	stats: ImportStats,
	options: {
		legislature?: string;
		status?: 'success' | 'partial' | 'failed';
		lastModifiedFilter?: Date;
		lastCursor?: string;
		metadata?: Record<string, unknown>;
	} = {}
): Promise<void> {
	const id = buildSyncId(source, entityType, options.legislature);
	const now = new Date();

	const data: NewSyncMetadata = {
		id,
		source,
		entityType,
		legislature: options.legislature || null,
		lastSyncAt: now,
		lastSyncStatus: options.status || 'success',
		recordsProcessed: stats.total,
		recordsInserted: stats.inserted,
		recordsUpdated: stats.updated,
		recordsSkipped: stats.skipped,
		recordsErrored: stats.errors,
		lastModifiedFilter: options.lastModifiedFilter || null,
		lastCursor: options.lastCursor || null,
		metadata: options.metadata || null,
		updatedAt: now
	};

	await db
		.insert(syncMetadata)
		.values(data)
		.onConflictDoUpdate({
			target: syncMetadata.id,
			set: {
				lastSyncAt: data.lastSyncAt,
				lastSyncStatus: data.lastSyncStatus,
				recordsProcessed: data.recordsProcessed,
				recordsInserted: data.recordsInserted,
				recordsUpdated: data.recordsUpdated,
				recordsSkipped: data.recordsSkipped,
				recordsErrored: data.recordsErrored,
				lastModifiedFilter: data.lastModifiedFilter,
				lastCursor: data.lastCursor,
				metadata: data.metadata,
				updatedAt: data.updatedAt
			}
		});
}

export function parseArgs(args: string[]): {
	incremental: boolean;
	legislature?: string;
	since?: Date;
} {
	const result: { incremental: boolean; legislature?: string; since?: Date } = {
		incremental: false
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '--incremental' || arg === '-i') {
			result.incremental = true;
		} else if (arg === '--legislature' || arg === '-l') {
			result.legislature = args[++i];
		} else if (arg === '--since' || arg === '-s') {
			result.since = new Date(args[++i]);
		}
	}

	return result;
}
