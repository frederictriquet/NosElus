import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const BASE_URL = 'https://data.assemblee-nationale.fr/static/openData/repository';
const LEGISLATURE = process.env.ETL_ASSEMBLEE_LEGISLATURE || '17';

interface DatasetInfo {
	name: string;
	url: string;
	outputDir: string;
}

const DATASETS: DatasetInfo[] = [
	{
		name: 'Acteurs et Organes',
		url: `${BASE_URL}/${LEGISLATURE}/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`,
		outputDir: 'acteurs_organes'
	},
	{
		name: 'Scrutins',
		url: `${BASE_URL}/${LEGISLATURE}/vp/scrutins/Scrutins_XVII.json.zip`,
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

async function main() {
	const dataDir = process.env.ETL_DATA_DIR || './data/assemblee';

	console.log('='.repeat(60));
	console.log('NosElus - Téléchargement des données');
	console.log('='.repeat(60));
	console.log(`Répertoire de destination: ${dataDir}`);
	console.log(`Législature: ${LEGISLATURE}`);
	console.log('');

	// Créer le répertoire de données
	if (!existsSync(dataDir)) {
		await mkdir(dataDir, { recursive: true });
	}

	for (const dataset of DATASETS) {
		console.log(`\n--- ${dataset.name} ---`);

		const outputDir = path.join(dataDir, dataset.outputDir);
		if (!existsSync(outputDir)) {
			await mkdir(outputDir, { recursive: true });
		}

		const filename = path.basename(dataset.url);
		const outputPath = path.join(outputDir, filename);

		try {
			await downloadFile(dataset.url, outputPath);
		} catch (error) {
			console.error(`Erreur: ${error}`);

			// Essayer une URL alternative
			console.log('Tentative avec URL alternative...');
			const altUrl = dataset.url.replace('.json.zip', '.xml.zip');
			try {
				await downloadFile(altUrl, outputPath.replace('.json.zip', '.xml.zip'));
			} catch {
				console.error(`Échec du téléchargement pour ${dataset.name}`);
			}
		}
	}

	console.log('\n' + '='.repeat(60));
	console.log('Téléchargement terminé!');
	console.log('');
	console.log('Prochaines étapes:');
	console.log('1. Décompresser les fichiers ZIP');
	console.log(`2. Configurer ETL_DATA_DIR=${dataDir}`);
	console.log('3. Lancer npm run etl:all');
	console.log('='.repeat(60));
}

main().catch(console.error);
