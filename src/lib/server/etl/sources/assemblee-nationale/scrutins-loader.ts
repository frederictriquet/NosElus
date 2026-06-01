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

// SCRUTINS_CACHE_TTL_HOURS : durée de validité du cache en heures (défaut: 24).
// Mettre à 0 pour désactiver le TTL et conserver le comportement permanent.
const CACHE_TTL_MS = Number(process.env.SCRUTINS_CACHE_TTL_HOURS ?? 24) * 60 * 60 * 1000;

function isCacheFresh(dir: string): boolean {
	const jsonDir = path.join(dir, 'json');
	if (!fs.existsSync(jsonDir)) return false;
	if (CACHE_TTL_MS === 0) return true;
	const { mtimeMs } = fs.statSync(jsonDir);
	return Date.now() - mtimeMs < CACHE_TTL_MS;
}

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

	// Vérifier la fraîcheur du cache (TTL via SCRUTINS_CACHE_TTL_HOURS)
	if (isCacheFresh(dir)) {
		console.log(`[AN Scrutins] Legislature ${legislature} cache frais, téléchargement ignoré`);
		return;
	}
	if (fs.existsSync(path.join(dir, 'json'))) {
		console.log(`[AN Scrutins] Legislature ${legislature} cache expiré, re-téléchargement...`);
		fs.rmSync(path.join(dir, 'json'), { recursive: true, force: true });
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

	// downloadScrutins gère le TTL en interne
	await downloadScrutins(legislature);

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
