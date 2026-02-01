import { db, scrutins } from '../../src/lib/server/db/index.js';
import { classifyScrutin } from '../../src/lib/server/etl/classify.js';
import { eq, sql, isNull } from 'drizzle-orm';

/**
 * Script de reclassification des scrutins existants.
 *
 * Ce script parcourt tous les scrutins de la base de données et leur assigne
 * une catégorie sémantique basée sur l'analyse de leur titre.
 *
 * Usage:
 *   npm run etl:classify-scrutins
 *   npm run etl:classify-scrutins -- --batch-size=1000
 *   npm run etl:classify-scrutins -- --dry-run
 */

interface Stats {
	total: number;
	processed: number;
	updated: number;
	errors: number;
	byCategory: Record<string, number>;
}

async function main() {
	const args = process.argv.slice(2);
	const batchSize = parseInt(
		args.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] || '500',
		10
	);
	const dryRun = args.includes('--dry-run');

	console.log('='.repeat(60));
	console.log('NosElus - Classification des scrutins');
	console.log('='.repeat(60));
	console.log(`Mode: ${dryRun ? 'DRY RUN (simulation)' : 'REAL (mise à jour DB)'}`);
	console.log(`Batch size: ${batchSize}`);
	console.log('');

	const stats: Stats = {
		total: 0,
		processed: 0,
		updated: 0,
		errors: 0,
		byCategory: {}
	};

	try {
		// Count total scrutins
		const [{ value: total }] = await db.select({ value: sql<number>`count(*)` }).from(scrutins);
		stats.total = total;
		console.log(`Total scrutins à classifier: ${total}`);
		console.log('');

		// Fetch all scrutins (id + title only for memory efficiency)
		console.log('Chargement des scrutins...');
		const allScrutins = await db
			.select({
				id: scrutins.id,
				title: scrutins.title,
				currentCategory: scrutins.category
			})
			.from(scrutins);

		console.log(`${allScrutins.length} scrutins chargés en mémoire`);
		console.log('');

		// Process in batches
		for (let i = 0; i < allScrutins.length; i += batchSize) {
			const batch = allScrutins.slice(i, i + batchSize);
			console.log(`Traitement du batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allScrutins.length / batchSize)} (${batch.length} scrutins)`);

			for (const scrutin of batch) {
				try {
					const category = classifyScrutin(scrutin.title);

					// Count by category
					stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

					// Update only if category changed or was null
					if (category !== scrutin.currentCategory) {
						if (!dryRun) {
							await db.update(scrutins).set({ category }).where(eq(scrutins.id, scrutin.id));
						}
						stats.updated++;
					}

					stats.processed++;
				} catch (error) {
					console.error(`Erreur pour scrutin ${scrutin.id}:`, error);
					stats.errors++;
				}
			}

			// Progress update
			const progress = ((i + batch.length) / allScrutins.length) * 100;
			console.log(`  Progress: ${progress.toFixed(1)}% (${i + batch.length}/${allScrutins.length})`);
		}

		console.log('');
		console.log('='.repeat(60));
		console.log('Classification terminée !');
		console.log('='.repeat(60));
		console.log(`Total: ${stats.total}`);
		console.log(`Traités: ${stats.processed}`);
		console.log(`Mis à jour: ${stats.updated}`);
		console.log(`Erreurs: ${stats.errors}`);
		console.log('');
		console.log('Répartition par catégorie:');
		const sortedCategories = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
		for (const [category, count] of sortedCategories) {
			const percentage = ((count / stats.total) * 100).toFixed(1);
			console.log(`  ${category.padEnd(20)} ${count.toString().padStart(6)} (${percentage}%)`);
		}
		console.log('');

		if (dryRun) {
			console.log('⚠️  DRY RUN - Aucune modification n\'a été effectuée en base');
			console.log('   Relancez sans --dry-run pour appliquer les modifications');
		} else {
			console.log('✓ Modifications appliquées en base de données');
		}

		process.exit(0);
	} catch (error) {
		console.error('Erreur lors de la classification:', error);
		process.exit(1);
	}
}

main();
