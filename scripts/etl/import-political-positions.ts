/**
 * ETL Script : Import des positions politiques depuis ParlGov
 *
 * Télécharge les données ParlGov, matche avec les groupes NosElus,
 * et met à jour la colonne political_position dans la table organs.
 *
 * Usage:
 *   npx tsx scripts/etl/import-political-positions.ts [options]
 *
 * Options:
 *   --test-connection   Test la connexion à ParlGov et affiche des exemples
 *   --dry-run           Simule l'import sans écrire en base de données
 *   --verbose           Affiche des logs détaillés
 *   --chamber=AN|PE|SENAT  Limite à une chambre spécifique
 *
 * @see ADR-004 : adr-2026-02-04-political-positioning-automation.md
 */

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { db, organs, adminSettings } from '../../src/lib/server/db';
import { eq, and, isNotNull, like } from 'drizzle-orm';
import {
	fetchPartiesForCountries,
	testConnection,
	findBestMatch,
	determinePosition,
	isNonInscrit,
	type ImportStats,
	type ParlGovParty
} from '../../src/lib/server/etl/sources/parlgov';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

// Parse CLI arguments
const { values: args } = parseArgs({
	options: {
		'test-connection': { type: 'boolean', default: false },
		'dry-run': { type: 'boolean', default: false },
		verbose: { type: 'boolean', default: false },
		chamber: { type: 'string' }
	}
});

const config = {
	testConnection: args['test-connection'],
	dryRun: args['dry-run'],
	verbose: args['verbose'],
	chamber: args['chamber'] as 'AN' | 'PE' | 'SENAT' | undefined
};

/**
 * Affiche le header du script
 */
function printHeader() {
	console.log('='.repeat(70));
	console.log('NosElus ETL - Import Political Positions from ParlGov');
	console.log('='.repeat(70));
	console.log(`Mode: ${config.dryRun ? 'DRY-RUN (no DB writes)' : 'LIVE'}`);
	console.log(`Verbose: ${config.verbose ? 'ON' : 'OFF'}`);
	if (config.chamber) {
		console.log(`Chamber filter: ${config.chamber}`);
	}
	console.log('');
}

/**
 * Affiche les statistiques finales
 */
function printStats(stats: ImportStats) {
	const duration = (stats.duration / 1000).toFixed(1);
	const successRate =
		stats.organsProcessed > 0 ? ((stats.matched / stats.organsProcessed) * 100).toFixed(1) : '0';

	console.log('');
	console.log('='.repeat(70));
	console.log('RESULTS');
	console.log('='.repeat(70));
	console.log(`  ParlGov parties fetched:    ${stats.partiesFetched}`);
	console.log(`  ParlGov parties (filtered): ${stats.partiesFiltered}`);
	console.log(`  NosElus organs processed:   ${stats.organsProcessed}`);
	console.log(`  Matched (Jaccard):          ${stats.matched}`);
	console.log(`  Not matched (fallback):     ${stats.notMatched}`);
	console.log(`  Positions updated in DB:    ${stats.updated}`);
	console.log(`  Errors:                     ${stats.errors}`);
	console.log(`  Success rate:               ${successRate}%`);
	console.log(`  Duration:                   ${duration}s`);
	console.log('='.repeat(70));
}

/**
 * Log verbose (seulement si --verbose)
 */
function logVerbose(message: string) {
	if (config.verbose) {
		console.log(message);
	}
}

/**
 * Exécution principale
 */
async function main() {
	printHeader();

	const stats: ImportStats = {
		partiesFetched: 0,
		partiesFiltered: 0,
		organsProcessed: 0,
		matched: 0,
		notMatched: 0,
		updated: 0,
		errors: 0,
		duration: 0
	};

	const startTime = Date.now();

	try {
		// Mode test-connection
		if (config.testConnection) {
			console.log('Testing ParlGov connection...\n');
			const success = await testConnection();
			process.exit(success ? 0 : 1);
		}

		// 1. Fetch ParlGov data
		console.log('[1/4] Fetching ParlGov data...');
		const allParties = await fetchPartiesForCountries({ countryCodes: ['FRA'] });
		stats.partiesFetched = allParties.length;
		stats.partiesFiltered = allParties.length;

		if (allParties.length === 0) {
			console.error('ERROR: No parties fetched from ParlGov');
			process.exit(1);
		}

		// 2. Get NosElus organs (groupes parlementaires)
		console.log('[2/4] Loading NosElus groups...');

		const whereConditions = [eq(organs.type, 'GP')];
		if (config.chamber) {
			whereConditions.push(eq(organs.chamber, config.chamber));
		}

		const groups = await db
			.select()
			.from(organs)
			.where(and(...whereConditions));

		console.log(`  Found ${groups.length} parliamentary groups`);
		stats.organsProcessed = groups.length;

		// 3. Match and determine positions
		console.log('[3/4] Matching groups to ParlGov parties...');
		console.log('');

		const results: Array<{
			organ: (typeof groups)[0];
			match: ReturnType<typeof findBestMatch>;
			position: number;
		}> = [];

		for (const organ of groups) {
			const match = findBestMatch(organ, allParties);
			const position = determinePosition(organ, match);

			// Ne pas écraser une position déjà seedée en DB (ex: groupes PE)
			// quand ParlGov n'a pas de meilleure donnée
			if (!match && organ.politicalPosition !== null) {
				logVerbose(
					`  ⊘ ${organ.shortName || organ.name.slice(0, 20)} → Keeping DB position ${organ.politicalPosition} (no ParlGov match)`
				);
				continue;
			}

			results.push({ organ, match, position });

			if (match) {
				stats.matched++;
				logVerbose(
					`  ✓ ${organ.shortName || organ.name.slice(0, 20)} → ${match.parlGovParty.nameNative} ` +
						`(score: ${match.score.toFixed(2)}, pos: ${position.toFixed(1)})`
				);
			} else if (isNonInscrit(organ)) {
				stats.notMatched++;
				logVerbose(`  - ${organ.shortName || organ.name.slice(0, 20)} → NI (pos: 999)`);
			} else {
				stats.notMatched++;
				logVerbose(
					`  ✗ ${organ.shortName || organ.name.slice(0, 20)} → No match (pos: ${position.toFixed(1)})`
				);
			}
		}

		console.log(`  Matched: ${stats.matched}/${stats.organsProcessed}`);
		console.log(`  Using fallback: ${stats.notMatched}`);

		// 4. Charger les settings de protection ETL
		console.log('');
		console.log('[4/4] Checking ETL protection settings...');

		const protectSettings = await db
			.select()
			.from(adminSettings)
			.where(like(adminSettings.key, 'etl_protect_%'));

		const protectedChambers = new Set(
			protectSettings
				.filter((s) => s.value === 'true')
				.map((s) => s.key.replace('etl_protect_', '').toUpperCase())
		);

		if (protectedChambers.size > 0) {
			console.log(`  Protected chambers: ${Array.from(protectedChambers).join(', ')}`);
		} else {
			console.log('  No chambers protected');
		}

		// Filtrer les résultats pour exclure les chambres protégées
		const updatableResults = results.filter((r) => {
			if (protectedChambers.has(r.organ.chamber)) {
				logVerbose(
					`  ⊘ ${r.organ.shortName || r.organ.name.slice(0, 20)} → Protected by admin (chamber ${r.organ.chamber})`
				);
				stats.notMatched++; // Compter comme non traité
				return false;
			}
			return true;
		});

		console.log(
			`  Will update ${updatableResults.length}/${results.length} organs (${results.length - updatableResults.length} protected)`
		);

		// 5. Update database
		console.log('');
		console.log('[5/5] Updating database...');

		if (config.dryRun) {
			console.log('  DRY-RUN mode: Skipping database updates');
			console.log('');
			console.log('  Would update:');

			for (const { organ, position } of updatableResults) {
				console.log(
					`    ${organ.id} (${organ.shortName || organ.name.slice(0, 15)}) → ${position.toFixed(1)}`
				);
			}

			stats.updated = updatableResults.length;
		} else {
			for (const { organ, position } of updatableResults) {
				try {
					await db
						.update(organs)
						.set({
							politicalPosition: position,
							updatedAt: new Date()
						})
						.where(eq(organs.id, organ.id));

					stats.updated++;
				} catch (error) {
					stats.errors++;
					console.error(`  ERROR updating ${organ.id}:`, error);
				}
			}

			console.log(`  Updated ${stats.updated} organs`);
		}
	} catch (error) {
		console.error('FATAL ERROR:', error);
		stats.errors++;
	}

	stats.duration = Date.now() - startTime;
	printStats(stats);

	await notifyETLComplete(
		'import-political-positions',
		{
			total: stats.organsProcessed,
			inserted: 0,
			updated: stats.updated,
			skipped: stats.organsProcessed - stats.updated - stats.errors,
			errors: stats.errors
		},
		{ dryRun: config.dryRun }
	);

	process.exit(stats.errors > 0 ? 1 : 0);
}

main();
