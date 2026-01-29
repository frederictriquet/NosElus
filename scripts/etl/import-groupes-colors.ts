/**
 * Import parliamentary group colors from nosdeputes.fr for all legislatures (12-17)
 *
 * This script fetches group information including colors from nosdeputes.fr
 * for both current and historical legislatures.
 *
 * Usage: npx tsx scripts/etl/import-groupes-colors.ts
 */

import { importGroupesFromNosdeputes } from '../../src/lib/server/etl/sources/nosdeputes/import.js';
import type { ETLConfig } from '../../src/lib/server/etl/types.js';

const LEGISLATURES = ['12', '13', '14', '15', '16', '17'];

// Mapping of legislature numbers to nosdeputes.fr subdomain format
// For older legislatures, nosdeputes.fr uses subdomains like 2017-2022.nosdeputes.fr
const LEGISLATURE_SUBDOMAINS: Record<string, string> = {
	'12': '2002-2007',
	'13': '2007-2012',
	'14': '2012-2017',
	'15': '2017-2022'
	// 16 and 17 use main domain (www.nosdeputes.fr)
};

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import des couleurs de groupes');
	console.log('='.repeat(60));
	console.log('');
	console.log('Ce script importe les groupes parlementaires avec leurs couleurs');
	console.log('depuis nosdeputes.fr pour toutes les législatures (12-17).');
	console.log('');

	const startTime = Date.now();
	const results: Record<string, { inserted: number; errors: number }> = {};

	for (const legislature of LEGISLATURES) {
		const subdomain = LEGISLATURE_SUBDOMAINS[legislature];
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

	for (const legislature of LEGISLATURES) {
		const result = results[legislature];
		console.log(`  Législature ${legislature}: ${result.inserted} groupes (${result.errors} erreurs)`);
		totalInserted += result.inserted;
		totalErrors += result.errors;
	}

	console.log('');
	console.log(`Total: ${totalInserted} groupes importés, ${totalErrors} erreurs`);
	console.log(`Durée: ${duration}s`);
	console.log('='.repeat(60));

	process.exit(totalErrors > 0 ? 1 : 0);
}

main();
