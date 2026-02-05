/**
 * Loader pour les amendements de l'Assemblée Nationale
 * Télécharge et extrait les données depuis data.assemblee-nationale.fr
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { ANAmendement } from './amendements-types';

const AMENDEMENTS_URLS: Record<string, string> = {
	'15': 'https://data.assemblee-nationale.fr/static/openData/repository/15/loi/amendements_legis/Amendements_XV.json.zip',
	'16': 'https://data.assemblee-nationale.fr/static/openData/repository/16/loi/amendements_div_legis/Amendements.json.zip',
	'17': 'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/amendements_div_legis/Amendements.json.zip'
};

// Use persistent cache directory (survives reboots)
const CACHE_DIR = process.env.ETL_CACHE_DIR || path.join(process.cwd(), 'data', 'cache');

function getAmendementsDir(legislature: string): string {
	return path.join(CACHE_DIR, `amendements_${legislature}`);
}

/**
 * Télécharge et extrait les amendements pour une législature donnée
 */
export async function downloadAmendements(legislature: string): Promise<void> {
	const url = AMENDEMENTS_URLS[legislature];
	if (!url) {
		throw new Error(
			`Unknown legislature: ${legislature}. Available: ${Object.keys(AMENDEMENTS_URLS).join(', ')}`
		);
	}

	// Ensure cache directory exists
	fs.mkdirSync(CACHE_DIR, { recursive: true });

	const dir = getAmendementsDir(legislature);

	// Check if data already exists
	if (fs.existsSync(path.join(dir, 'json'))) {
		console.log(`[AN Amendements] Legislature ${legislature} already extracted, skipping download`);
		return;
	}

	console.log(`[AN Amendements] Downloading amendements for legislature ${legislature}...`);
	console.log(`[AN Amendements] Cache directory: ${CACHE_DIR}`);
	console.log(`[AN Amendements] URL: ${url}`);

	const zipFile = path.join(CACHE_DIR, `amendements_${legislature}.json.zip`);

	// Download with curl (handles redirects and large files well)
	execSync(`curl -sL "${url}" -o "${zipFile}"`, { stdio: 'inherit' });

	// Extract
	fs.mkdirSync(dir, { recursive: true });
	execSync(`unzip -o "${zipFile}" -d "${dir}"`, { stdio: 'inherit' });

	console.log(`[AN Amendements] Legislature ${legislature} extracted successfully`);
}

/**
 * Compte le nombre de fichiers JSON récursivement
 */
function countJsonFiles(dir: string): number {
	let count = 0;
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			count += countJsonFiles(fullPath);
		} else if (entry.name.endsWith('.json')) {
			count++;
		}
	}

	return count;
}

/**
 * Charge tous les amendements pour une législature donnée
 */
export async function loadAmendements(legislature: string): Promise<ANAmendement[]> {
	if (!AMENDEMENTS_URLS[legislature]) {
		throw new Error(
			`Unknown legislature: ${legislature}. Available: ${Object.keys(AMENDEMENTS_URLS).join(', ')}`
		);
	}

	const dir = getAmendementsDir(legislature);
	const jsonDir = path.join(dir, 'json');

	if (!fs.existsSync(jsonDir)) {
		await downloadAmendements(legislature);
	}

	const totalFiles = countJsonFiles(jsonDir);
	console.log(
		`[AN Amendements] Loading ~${totalFiles} amendements for legislature ${legislature}...`
	);

	const amendements: ANAmendement[] = [];
	let loaded = 0;
	let errors = 0;

	// Recursive function to load all JSON files
	function loadFromDir(currentDir: string): void {
		const entries = fs.readdirSync(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);

			if (entry.isDirectory()) {
				loadFromDir(fullPath);
			} else if (entry.name.endsWith('.json')) {
				try {
					const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
					if (data.amendement) {
						amendements.push(data);
						loaded++;

						if (loaded % 5000 === 0) {
							console.log(`[AN Amendements] Loaded ${loaded}/${totalFiles} amendements...`);
						}
					}
				} catch (error) {
					errors++;
					if (errors <= 5) {
						console.error(`[AN Amendements] Error loading ${fullPath}:`, error);
					}
				}
			}
		}
	}

	loadFromDir(jsonDir);

	console.log(`[AN Amendements] Loaded ${loaded} amendements (${errors} errors)`);
	return amendements;
}

/**
 * Charge tous les amendements pour toutes les législatures disponibles
 */
export async function loadAllAmendements(): Promise<ANAmendement[]> {
	const allAmendements: ANAmendement[] = [];

	for (const legislature of Object.keys(AMENDEMENTS_URLS)) {
		await downloadAmendements(legislature);
		const amendements = await loadAmendements(legislature);
		allAmendements.push(...amendements);
	}

	return allAmendements;
}

/**
 * Retourne les législatures disponibles pour les amendements
 */
export function getAvailableAmendementsLegislatures(): string[] {
	return Object.keys(AMENDEMENTS_URLS);
}
