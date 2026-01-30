import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = 'data/cache';

export interface CacheOptions {
	ttlHours: number;
}

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttlMs: number;
}

/**
 * Get cached data if valid
 */
export async function getCache<T>(key: string, options: CacheOptions): Promise<T | null> {
	const filePath = path.join(CACHE_DIR, `${key}.json`);

	try {
		const content = await fs.readFile(filePath, 'utf-8');
		const entry: CacheEntry<T> = JSON.parse(content);

		const now = Date.now();
		if (now - entry.timestamp < entry.ttlMs) {
			return entry.data;
		}

		// Cache expired, delete it
		await fs.unlink(filePath).catch(() => {});
		return null;
	} catch {
		return null;
	}
}

/**
 * Set cache data
 */
export async function setCache<T>(key: string, data: T, options: CacheOptions): Promise<void> {
	const filePath = path.join(CACHE_DIR, `${key}.json`);

	const entry: CacheEntry<T> = {
		data,
		timestamp: Date.now(),
		ttlMs: options.ttlHours * 60 * 60 * 1000
	};

	try {
		await fs.mkdir(CACHE_DIR, { recursive: true });
		await fs.writeFile(filePath, JSON.stringify(entry));
	} catch (error) {
		console.error(`[Cache] Failed to write cache ${key}:`, error);
	}
}

/**
 * Clear cache entry
 */
export async function clearCache(key: string): Promise<void> {
	const filePath = path.join(CACHE_DIR, `${key}.json`);
	await fs.unlink(filePath).catch(() => {});
}
