import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { ANActeur, ANOrgane } from './types';

const DATA_URL =
	'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip';

const DATA_DIR = '/tmp/an_data';
const ZIP_FILE = '/tmp/an_historique.json.zip';

/**
 * Télécharge et extrait les données de l'Assemblée Nationale
 */
export async function downloadAndExtractData(): Promise<void> {
	// Check if data already exists
	if (fs.existsSync(path.join(DATA_DIR, 'json', 'acteur'))) {
		console.log('[AN] Data already extracted, skipping download');
		return;
	}

	console.log('[AN] Downloading data from data.assemblee-nationale.fr...');

	// Download zip file
	execSync(`curl -sL "${DATA_URL}" -o "${ZIP_FILE}"`, { stdio: 'inherit' });

	// Create data directory
	fs.mkdirSync(DATA_DIR, { recursive: true });

	// Extract zip
	console.log('[AN] Extracting data...');
	execSync(`unzip -o "${ZIP_FILE}" -d "${DATA_DIR}"`, { stdio: 'inherit' });

	console.log('[AN] Data extracted successfully');
}

/**
 * Charge tous les acteurs depuis les fichiers JSON
 */
export async function loadActeurs(): Promise<ANActeur[]> {
	const acteurDir = path.join(DATA_DIR, 'json', 'acteur');
	const files = fs.readdirSync(acteurDir).filter((f) => f.endsWith('.json'));

	console.log(`[AN] Loading ${files.length} acteurs...`);

	const acteurs: ANActeur[] = [];
	for (const file of files) {
		try {
			const data = JSON.parse(fs.readFileSync(path.join(acteurDir, file), 'utf-8'));
			acteurs.push(data);
		} catch (error) {
			console.error(`[AN] Error loading ${file}:`, error);
		}
	}

	return acteurs;
}

/**
 * Charge tous les organes depuis les fichiers JSON
 */
export async function loadOrganes(): Promise<ANOrgane[]> {
	const organeDir = path.join(DATA_DIR, 'json', 'organe');
	const files = fs.readdirSync(organeDir).filter((f) => f.endsWith('.json'));

	console.log(`[AN] Loading ${files.length} organes...`);

	const organes: ANOrgane[] = [];
	for (const file of files) {
		try {
			const data = JSON.parse(fs.readFileSync(path.join(organeDir, file), 'utf-8'));
			organes.push(data);
		} catch (error) {
			console.error(`[AN] Error loading ${file}:`, error);
		}
	}

	return organes;
}

/**
 * Charge uniquement les groupes parlementaires (type GP)
 */
export async function loadGroupesParlementaires(): Promise<ANOrgane[]> {
	const organes = await loadOrganes();
	return organes.filter((o) => o.organe.codeType === 'GP');
}

/**
 * Filtre les acteurs qui ont au moins un mandat de député AN
 */
export function filterDeputes(acteurs: ANActeur[]): ANActeur[] {
	return acteurs.filter((a) => {
		const mandats = Array.isArray(a.acteur.mandats.mandat)
			? a.acteur.mandats.mandat
			: [a.acteur.mandats.mandat];
		return mandats.some((m) => m.typeOrgane === 'ASSEMBLEE');
	});
}
