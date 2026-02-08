/**
 * Import parliamentary group colors from nosdeputes.fr for all legislatures
 *
 * This script fetches group information including colors from nosdeputes.fr
 * for both current and historical legislatures.
 *
 * The list of legislatures is retrieved dynamically from the database.
 *
 * Usage: npx tsx scripts/etl/import-groupes-colors.ts
 */

import { importGroupesFromNosdeputes } from '../../src/lib/server/etl/sources/nosdeputes/import.js';
import type { ETLConfig } from '../../src/lib/server/etl/types.js';
import { db, organs } from '../../src/lib/server/db/index.js';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

/**
 * Mapping of legislature numbers to nosdeputes.fr subdomain format
 * For older legislatures, nosdeputes.fr uses subdomains like 2017-2022.nosdeputes.fr
 * This is API configuration, not business data - it reflects how nosdeputes.fr structures their URLs
 */
function getSubdomainForLegislature(legislature: string): string | null {
	const num = parseInt(legislature, 10);
	if (num >= 16) return null; // Uses main domain

	// Calculate subdomain based on legislature number
	// Legislature 12 = 2002-2007, 13 = 2007-2012, etc.
	// Pattern: startYear = 1997 + (legislature - 11) * 5
	const startYear = 1997 + (num - 11) * 5;
	const endYear = startYear + 5;
	return `${startYear}-${endYear}`;
}

/**
 * Get distinct legislatures from the database (AN groups only)
 */
async function getLegislaturesFromDb(): Promise<string[]> {
	const result = await db
		.selectDistinct({ legislature: organs.legislature })
		.from(organs)
		.where(and(eq(organs.chamber, 'AN'), eq(organs.type, 'GP'), isNotNull(organs.legislature)))
		.orderBy(sql`${organs.legislature}::int DESC`);

	return result.filter((r) => r.legislature !== null).map((r) => r.legislature!);
}

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import des couleurs de groupes');
	console.log('='.repeat(60));
	console.log('');
	console.log('Ce script importe les groupes parlementaires avec leurs couleurs');
	console.log('depuis nosdeputes.fr pour toutes les législatures disponibles.');
	console.log('');

	// Get legislatures dynamically from DB
	const legislatures = await getLegislaturesFromDb();

	if (legislatures.length === 0) {
		console.log("⚠ Aucune législature trouvée en base. Exécutez d'abord l'import des groupes AN.");
		process.exit(1);
	}

	console.log(`Législatures trouvées: ${legislatures.join(', ')}`);
	console.log('');

	const startTime = Date.now();
	const results: Record<string, { inserted: number; errors: number }> = {};

	for (const legislature of legislatures) {
		const subdomain = getSubdomainForLegislature(legislature);
		const domain = subdomain ? `${subdomain}.nosdeputes.fr` : 'www.nosdeputes.fr';

		console.log('\n' + '-'.repeat(40));
		console.log(`Législature ${legislature} (${domain})`);
		console.log('-'.repeat(40));

		// config.legislature is used for the API URL (subdomain or legislature number)
		// The second parameter (legislature) is the actual legislature number for the database
		const config: ETLConfig = {
			legislature: subdomain || legislature,
			batchSize: 100
		};

		try {
			// Pass the actual legislature number as second parameter
			const stats = await importGroupesFromNosdeputes(config, legislature);
			results[legislature] = { inserted: stats.inserted, errors: stats.errors };
			console.log(`✓ ${stats.inserted} groupes importés, ${stats.errors} erreurs`);
		} catch (error) {
			console.error(`✗ Erreur pour la législature ${legislature}:`, error);
			results[legislature] = { inserted: 0, errors: 1 };
		}

		// Rate limiting between legislatures
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	const duration = ((Date.now() - startTime) / 1000).toFixed(1);

	console.log('\n' + '='.repeat(60));
	console.log('RÉSUMÉ');
	console.log('='.repeat(60));

	let totalInserted = 0;
	let totalErrors = 0;

	for (const legislature of legislatures) {
		const result = results[legislature];
		if (result) {
			console.log(
				`  Législature ${legislature}: ${result.inserted} groupes (${result.errors} erreurs)`
			);
			totalInserted += result.inserted;
			totalErrors += result.errors;
		}
	}

	console.log('');
	console.log(`Total: ${totalInserted} groupes importés, ${totalErrors} erreurs`);
	console.log(`Durée: ${duration}s`);
	console.log('='.repeat(60));

	await notifyETLComplete('import-groupes-colors', {
		total: totalInserted + totalErrors,
		inserted: totalInserted,
		updated: 0,
		skipped: 0,
		errors: totalErrors
	});

	process.exit(totalErrors > 0 ? 1 : 0);
}

main();
