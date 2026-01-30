import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

// Cache directory for photos
const CACHE_DIR = '.cache/photos';
const CACHE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

// In-memory cache for 404s to avoid repeated requests
const notFoundCache = new Set<string>();

async function ensureCacheDir(): Promise<void> {
	try {
		await fs.mkdir(CACHE_DIR, { recursive: true });
	} catch {
		// Directory already exists
	}
}

function getCachePath(urlPath: string): string {
	// Convert URL path to safe filename
	const safeName = urlPath.replace(/[^a-zA-Z0-9.-]/g, '_');
	return path.join(CACHE_DIR, safeName);
}

export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const urlPath = params.path;

	if (!urlPath) {
		throw error(400, 'Missing path parameter');
	}

	// Only allow assemblee-nationale.fr paths
	if (!urlPath.startsWith('dyn/') && !urlPath.startsWith('tribun/')) {
		throw error(400, 'Invalid path');
	}

	const sourceUrl = `https://www.assemblee-nationale.fr/${urlPath}`;
	const cachePath = getCachePath(urlPath);

	// Check if this URL is known to 404
	if (notFoundCache.has(urlPath)) {
		throw error(404, 'Photo not found');
	}

	// Try to serve from file cache
	try {
		const cachedData = await fs.readFile(cachePath);
		setHeaders({
			'Content-Type': 'image/jpeg',
			'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
			'X-Cache': 'HIT'
		});
		return new Response(cachedData);
	} catch {
		// Not in cache, fetch from source
	}

	// Fetch from Assemblée Nationale
	try {
		const response = await fetch(sourceUrl, {
			headers: {
				'User-Agent': 'NosElus/1.0 (https://noselus.fr)',
				'Accept': 'image/*'
			}
		});

		if (!response.ok) {
			if (response.status === 404) {
				// Remember this URL returns 404
				notFoundCache.add(urlPath);
			}
			throw error(response.status, `Failed to fetch photo: ${response.statusText}`);
		}

		const contentType = response.headers.get('content-type') || 'image/jpeg';
		const imageData = await response.arrayBuffer();
		const buffer = Buffer.from(imageData);

		// Save to file cache (async, don't wait)
		ensureCacheDir().then(() => {
			fs.writeFile(cachePath, buffer).catch(() => {
				// Ignore cache write errors
			});
		});

		setHeaders({
			'Content-Type': contentType,
			'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
			'X-Cache': 'MISS'
		});

		return new Response(buffer);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error(`Failed to fetch photo from ${sourceUrl}:`, err);
		throw error(502, 'Failed to fetch photo from source');
	}
};
