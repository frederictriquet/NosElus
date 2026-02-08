import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { existsSync, createReadStream, createWriteStream } from 'fs';
import { createUnzip } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';
import { execSync } from 'child_process';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const BASE_URL = 'https://data.assemblee-nationale.fr/static/openData/repository';
const LEGISLATURE = process.env.ETL_ASSEMBLEE_LEGISLATURE || '16';

interface DatasetInfo {
	name: string;
	url: string;
	outputDir: string;
}

// URLs pour la législature 16 et 17
const DATASETS: DatasetInfo[] = [
	{
		name: 'Acteurs et Organes',
		url: `${BASE_URL}/${LEGISLATURE}/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`,
		outputDir: 'acteurs_organes'
	},
	{
		name: 'Scrutins',
		url: `${BASE_URL}/${LEGISLATURE}/vp/scrutins/Scrutins.json.zip`,
		outputDir: 'scrutins'
	}
];

async function downloadFile(url: string, outputPath: string): Promise<void> {
	console.log(`Téléchargement: ${url}`);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
	}

	const buffer = await response.arrayBuffer();
	await writeFile(outputPath, Buffer.from(buffer));
	console.log(`  -> Sauvegardé: ${outputPath}`);
}

async function unzipFile(zipPath: string, outputDir: string): Promise<void> {
	console.log(`Décompression: ${zipPath}`);

	try {
		// Utiliser unzip système (plus fiable pour les gros fichiers)
		execSync(`unzip -o "${zipPath}" -d "${outputDir}"`, { stdio: 'pipe' });
		console.log(`  -> Décompressé dans: ${outputDir}`);
	} catch (error) {
		console.error(`Erreur lors de la décompression:`, error);
		throw error;
	}
}

async function main() {
	const dataDir = process.env.ETL_DATA_DIR || './data/assemblee';

	console.log('='.repeat(60));
	console.log('NosElus - Téléchargement des données Assemblée Nationale');
	console.log('='.repeat(60));
	console.log(`Répertoire de destination: ${dataDir}`);
	console.log(`Législature: ${LEGISLATURE}`);
	console.log('');

	// Créer le répertoire de données
	if (!existsSync(dataDir)) {
		await mkdir(dataDir, { recursive: true });
	}

	let errors = 0;

	for (const dataset of DATASETS) {
		console.log(`\n--- ${dataset.name} ---`);

		const outputDir = path.join(dataDir, dataset.outputDir);
		if (!existsSync(outputDir)) {
			await mkdir(outputDir, { recursive: true });
		}

		const filename = path.basename(dataset.url);
		const zipPath = path.join(outputDir, filename);

		try {
			// Télécharger
			await downloadFile(dataset.url, zipPath);

			// Décompresser
			await unzipFile(zipPath, outputDir);

			// Supprimer le ZIP
			await unlink(zipPath);
			console.log(`  -> ZIP supprimé`);
		} catch (error) {
			console.error(`Erreur: ${error}`);

			// Essayer une URL alternative (avec numéro de législature en chiffres romains)
			const altUrls = [
				dataset.url.replace('Scrutins.json.zip', `Scrutins_XVI.json.zip`),
				dataset.url.replace('Scrutins.json.zip', `Scrutins_XVII.json.zip`),
				dataset.url.replace('.json.zip', '.xml.zip')
			];

			let recovered = false;
			for (const altUrl of altUrls) {
				if (altUrl !== dataset.url) {
					console.log(`Tentative avec URL alternative: ${altUrl}`);
					try {
						const altFilename = path.basename(altUrl);
						const altZipPath = path.join(outputDir, altFilename);
						await downloadFile(altUrl, altZipPath);
						await unzipFile(altZipPath, outputDir);
						await unlink(altZipPath);
						recovered = true;
						break;
					} catch {
						continue;
					}
				}
			}
			if (!recovered) {
				errors++;
			}
		}
	}

	console.log('\n' + '='.repeat(60));
	console.log('Téléchargement terminé!');
	console.log('='.repeat(60));
	console.log('');
	console.log('Prochaines étapes:');
	console.log(`  export ETL_DATA_DIR=${dataDir}`);
	console.log('  npm run etl:all');
	console.log('='.repeat(60));

	await notifyETLComplete(
		'download-data',
		{
			total: DATASETS.length,
			inserted: DATASETS.length - errors,
			updated: 0,
			skipped: 0,
			errors
		},
		{ dryRun: process.argv.includes('--dry-run') }
	);
}

main().catch(console.error);
