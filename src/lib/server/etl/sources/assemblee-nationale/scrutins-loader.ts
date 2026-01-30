import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { ANScrutin } from './scrutins-types';

const SCRUTINS_URLS: Record<string, string> = {
	'15': 'https://data.assemblee-nationale.fr/static/openData/repository/15/loi/scrutins/Scrutins_XV.json.zip',
	'16': 'https://data.assemblee-nationale.fr/static/openData/repository/16/loi/scrutins/Scrutins.json.zip',
	'17': 'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip'
};

// Use persistent cache directory (survives reboots)
const CACHE_DIR = process.env.ETL_CACHE_DIR || path.join(process.cwd(), 'data', 'cache');

function getScrutinsDir(legislature: string): string {
	return path.join(CACHE_DIR, `scrutins_${legislature}`);
}

/**
 * Télécharge et extrait les scrutins pour une législature donnée
 */
export async function downloadScrutins(legislature: string): Promise<void> {
	const url = SCRUTINS_URLS[legislature];
	if (!url) {
		throw new Error(`Unknown legislature: ${legislature}`);
	}

	// Ensure cache directory exists
	fs.mkdirSync(CACHE_DIR, { recursive: true });

	const dir = getScrutinsDir(legislature);

	// Check if data already exists
	if (fs.existsSync(path.join(dir, 'json'))) {
		console.log(`[AN Scrutins] Legislature ${legislature} already extracted, skipping download`);
		return;
	}

	console.log(`[AN Scrutins] Downloading scrutins for legislature ${legislature}...`);
	console.log(`[AN Scrutins] Cache directory: ${CACHE_DIR}`);

	const zipFile = path.join(CACHE_DIR, `scrutins_${legislature}.json.zip`);
	execSync(`curl -sL "${url}" -o "${zipFile}"`, { stdio: 'inherit' });

	fs.mkdirSync(dir, { recursive: true });
	execSync(`unzip -o "${zipFile}" -d "${dir}"`, { stdio: 'inherit' });

	console.log(`[AN Scrutins] Legislature ${legislature} extracted successfully`);
}

/**
 * Charge tous les scrutins pour une législature donnée
 */
export async function loadScrutins(legislature: string): Promise<ANScrutin[]> {
	if (!SCRUTINS_URLS[legislature]) {
		throw new Error(`Unknown legislature: ${legislature}`);
	}

	const dir = getScrutinsDir(legislature);
	const jsonDir = path.join(dir, 'json');

	if (!fs.existsSync(jsonDir)) {
		await downloadScrutins(legislature);
	}

	const files = fs.readdirSync(jsonDir).filter((f) => f.endsWith('.json'));
	console.log(`[AN Scrutins] Loading ${files.length} scrutins for legislature ${legislature}...`);

	const scrutins: ANScrutin[] = [];
	for (const file of files) {
		try {
			const data = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf-8'));
			scrutins.push(data);
		} catch (error) {
			console.error(`[AN Scrutins] Error loading ${file}:`, error);
		}
	}

	return scrutins;
}

/**
 * Charge tous les scrutins pour toutes les législatures disponibles
 */
export async function loadAllScrutins(): Promise<ANScrutin[]> {
	const allScrutins: ANScrutin[] = [];

	for (const legislature of Object.keys(SCRUTINS_URLS)) {
		await downloadScrutins(legislature);
		const scrutins = await loadScrutins(legislature);
		allScrutins.push(...scrutins);
	}

	return allScrutins;
}

/**
 * Retourne les législatures disponibles
 */
export function getAvailableLegislatures(): string[] {
	return Object.keys(SCRUTINS_URLS);
}
