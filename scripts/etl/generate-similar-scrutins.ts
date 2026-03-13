/**
 * Script ETL pour pré-calculer les voisins sémantiques des scrutins.
 * Génère la table scrutin_similar utilisée pour enrichir la recherche.
 *
 * Usage:
 *   npm run etl:generate-similar
 *   npm run etl:generate-similar -- --limit 200
 *   npm run etl:generate-similar -- --neighbors 10 --threshold 0.80
 *   npm run etl:generate-similar -- --dry-run
 *
 * Prérequis:
 *   1. @huggingface/transformers installé (devDependency)
 *   2. Connexion DB configurée (.env)
 *   3. Migration 0020_scrutin_similar.sql appliquée
 */

import 'dotenv/config';
import {
	cosineSimilarity,
	computeTopNeighbors,
	getScrutinsWithoutNeighbors,
	saveSimilarScrutins,
	EMBEDDING_MODEL,
	DEFAULT_NEIGHBORS,
	DEFAULT_THRESHOLD
} from '../../src/lib/server/etl/sources/semantic/scrutin-embedder.js';

interface Args {
	limit: number;
	neighbors: number;
	threshold: number;
	dryRun: boolean;
	help: boolean;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		limit: 5000,
		neighbors: DEFAULT_NEIGHBORS,
		threshold: DEFAULT_THRESHOLD,
		dryRun: false,
		help: false
	};
	for (let i = 0; i < argv.length; i++) {
		switch (argv[i]) {
			case '--limit':
				args.limit = parseInt(argv[++i]);
				break;
			case '--neighbors':
				args.neighbors = parseInt(argv[++i]);
				break;
			case '--threshold':
				args.threshold = parseFloat(argv[++i]);
				break;
			case '--dry-run':
				args.dryRun = true;
				break;
			case '--help':
			case '-h':
				args.help = true;
				break;
		}
	}
	return args;
}

function printHelp() {
	console.log(`
Usage: npm run etl:generate-similar -- [options]

Options:
  --limit <n>        Nombre max de scrutins à traiter (défaut: 5000)
  --neighbors <n>    Voisins à conserver par scrutin (défaut: ${DEFAULT_NEIGHBORS})
  --threshold <f>    Score minimum [0-1] (défaut: ${DEFAULT_THRESHOLD})
  --dry-run          Calcule sans écrire en base
  -h, --help         Affiche cette aide

Modèle utilisé: ${EMBEDDING_MODEL}

Note: Ce script ne traite que les scrutins sans entrées dans scrutin_similar.
      Relancez-le après chaque import de nouveaux scrutins.
`);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		process.exit(0);
	}

	console.log('🔍 generate-similar-scrutins — démarrage');
	console.log(`   Modèle    : ${EMBEDDING_MODEL}`);
	console.log(`   Voisins   : ${args.neighbors}`);
	console.log(`   Seuil     : ${args.threshold}`);
	console.log(`   Dry-run   : ${args.dryRun}`);

	// Chargement dynamique pour ne pas importer en production
	const { pipeline } = await import('@huggingface/transformers');

	console.log('\n📦 Chargement du modèle (premier run = téléchargement ~118 MB)...');
	const embedder = await pipeline('feature-extraction', EMBEDDING_MODEL, {
		dtype: 'q8'
	});
	console.log('✅ Modèle chargé');

	// Récupérer les scrutins à traiter
	console.log(`\n📋 Récupération des scrutins sans voisins (max ${args.limit})...`);
	const scrutinsToProcess = await getScrutinsWithoutNeighbors(args.limit);
	console.log(`   ${scrutinsToProcess.length} scrutins à traiter`);

	if (scrutinsToProcess.length === 0) {
		console.log('✅ Tous les scrutins ont déjà des voisins. Rien à faire.');
		process.exit(0);
	}

	// Générer les embeddings par batch
	const EMBED_BATCH = 32;
	const embeddings: Float32Array[] = [];
	const ids: string[] = scrutinsToProcess.map((s) => s.id);

	console.log(
		`\n🔢 Génération des embeddings (${scrutinsToProcess.length} scrutins, batch ${EMBED_BATCH})...`
	);
	const startEmbed = Date.now();

	for (let i = 0; i < scrutinsToProcess.length; i += EMBED_BATCH) {
		const batch = scrutinsToProcess.slice(i, i + EMBED_BATCH);
		const texts = batch.map((s) => `query: ${s.title}${s.description ? ' ' + s.description : ''}`);
		const output = await embedder(texts, { pooling: 'mean', normalize: true });
		for (let k = 0; k < batch.length; k++) {
			embeddings.push(new Float32Array(output[k].data));
		}
		if ((i / EMBED_BATCH) % 10 === 0) {
			process.stdout.write(
				`\r   ${i + batch.length}/${scrutinsToProcess.length} embeddings générés`
			);
		}
	}

	const embedTime = Math.round((Date.now() - startEmbed) / 1000);
	console.log(`\n✅ Embeddings générés en ${embedTime}s`);

	// Calcul des voisins
	console.log(`\n🔗 Calcul des voisins (O(N²/2) sur ${ids.length} scrutins)...`);
	const startNeighbors = Date.now();
	const pairs = computeTopNeighbors(ids, embeddings, args.neighbors, args.threshold);
	const neighborTime = Math.round((Date.now() - startNeighbors) / 1000);
	console.log(`✅ ${pairs.length} paires trouvées en ${neighborTime}s`);

	if (args.dryRun) {
		console.log('\n🧪 Dry-run — exemples de paires :');
		pairs
			.slice(0, 5)
			.forEach((p) => console.log(`   ${p.scrutinId} ↔ ${p.similarId} (score: ${p.score})`));
		console.log('\nDry-run terminé. Aucune écriture effectuée.');
		process.exit(0);
	}

	// Insertion en base
	console.log(`\n💾 Insertion de ${pairs.length} paires en base...`);
	const inserted = await saveSimilarScrutins(pairs);
	console.log(`✅ ${inserted} paires insérées`);
	console.log('\n🎉 generate-similar-scrutins terminé avec succès');

	process.exit(0);
}

main().catch((err) => {
	console.error('❌ Erreur fatale:', err);
	process.exit(1);
});

// Ré-exporter pour les tests
export { cosineSimilarity };
