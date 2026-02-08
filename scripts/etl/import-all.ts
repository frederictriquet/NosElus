import {
	importActors,
	importOrgans,
	importMandates
} from '../../src/lib/server/etl/sources/assemblee/actors.js';
import {
	importScrutins,
	importVotes
} from '../../src/lib/server/etl/sources/assemblee/scrutins.js';
import { importLaws, linkScrutinsToLaws } from '../../src/lib/server/etl/sources/assemblee/laws.js';
import { getETLConfig, type ImportStats } from '../../src/lib/server/etl/types.js';
import { parseArgs, getLastSync, updateSyncMetadata } from '../../src/lib/server/etl/utils.js';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const SOURCE = 'assemblee';

// Helper to safely update sync metadata (ignore errors if table doesn't exist)
async function safeUpdateSyncMetadata(
	entityType: string,
	stats: ImportStats,
	options: { legislature: string; status: string }
) {
	try {
		await updateSyncMetadata(SOURCE, entityType, stats, options);
	} catch {
		// Ignore sync_metadata errors
	}
}

function printUsage() {
	console.log('Usage: npm run etl:all [options]');
	console.log('');
	console.log('Options:');
	console.log('  --incremental, -i    Only import records modified since last sync');
	console.log(
		'  --legislature, -l    Legislature to import (default: from ETL_ASSEMBLEE_LEGISLATURE or 16)'
	);
	console.log('  --since, -s          Import records modified since this date (ISO format)');
	console.log('');
	console.log('Examples:');
	console.log('  npm run etl:all                     # Full import');
	console.log('  npm run etl:all -- --incremental    # Incremental import');
	console.log('  npm run etl:all -- -i -l 17         # Incremental import for legislature 17');
	console.log('');
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	if (process.argv.includes('--help') || process.argv.includes('-h')) {
		printUsage();
		process.exit(0);
	}

	console.log('='.repeat(60));
	console.log('NosElus ETL - Full Import');
	console.log('='.repeat(60));

	const baseConfig = getETLConfig();
	const config = {
		...baseConfig,
		legislature: args.legislature || baseConfig.legislature,
		incremental: args.incremental,
		since: args.since
	};

	console.log(`Configuration:`);
	console.log(`  Legislature: ${config.legislature}`);
	console.log(`  Batch size: ${config.batchSize}`);
	console.log(`  Data dir: ${config.dataDir || 'NOT SET'}`);
	console.log(`  Mode: ${config.incremental ? 'INCREMENTAL' : 'FULL'}`);

	if (config.incremental) {
		// Get last sync time for the most recent entity type
		const lastSync = await getLastSync(SOURCE, 'actors', config.legislature);
		if (lastSync) {
			console.log(`  Last sync: ${lastSync.lastSyncAt.toISOString()}`);
			if (!config.since) {
				config.since = lastSync.lastSyncAt;
			}
		} else {
			console.log(`  Last sync: Never (first run will be full import)`);
		}
	}
	console.log('');

	if (!config.dataDir) {
		console.error('ERROR: ETL_DATA_DIR environment variable is required');
		console.error('');
		console.error('Please download the Assemblée nationale data first:');
		console.error('  1. Clone: git clone https://git.tricoteuses.fr/data/assemblee.git');
		console.error('  2. Set: export ETL_DATA_DIR=/path/to/assemblee');
		console.error('');
		process.exit(1);
	}

	const startTime = Date.now();
	const allStats: Record<string, ImportStats> = {};

	try {
		// Step 1: Import organs (needed for foreign keys)
		console.log('\n' + '='.repeat(40));
		console.log('Step 1/7: Importing Organs');
		console.log('='.repeat(40));
		const organsStats = await importOrgans(config);
		allStats.organs = organsStats;
		console.log(
			`✓ Organs: ${organsStats.inserted} inserted, ${organsStats.updated} updated, ${organsStats.errors} errors`
		);
		await safeUpdateSyncMetadata('organs', organsStats, {
			legislature: config.legislature,
			status: organsStats.errors > 0 ? 'partial' : 'success'
		});

		// Step 2: Import actors
		console.log('\n' + '='.repeat(40));
		console.log('Step 2/7: Importing Actors');
		console.log('='.repeat(40));
		const actorsStats = await importActors(config);
		allStats.actors = actorsStats;
		console.log(
			`✓ Actors: ${actorsStats.inserted} inserted, ${actorsStats.updated} updated, ${actorsStats.errors} errors`
		);
		await safeUpdateSyncMetadata('actors', actorsStats, {
			legislature: config.legislature,
			status: actorsStats.errors > 0 ? 'partial' : 'success'
		});

		// Step 3: Import mandates
		console.log('\n' + '='.repeat(40));
		console.log('Step 3/7: Importing Mandates');
		console.log('='.repeat(40));
		const mandatesStats = await importMandates(config);
		allStats.mandates = mandatesStats;
		console.log(
			`✓ Mandates: ${mandatesStats.inserted} inserted, ${mandatesStats.updated} updated, ${mandatesStats.errors} errors`
		);
		await safeUpdateSyncMetadata('mandates', mandatesStats, {
			legislature: config.legislature,
			status: mandatesStats.errors > 0 ? 'partial' : 'success'
		});

		// Step 4: Import scrutins
		console.log('\n' + '='.repeat(40));
		console.log('Step 4/7: Importing Scrutins');
		console.log('='.repeat(40));
		const scrutinsStats = await importScrutins(config);
		allStats.scrutins = scrutinsStats;
		console.log(
			`✓ Scrutins: ${scrutinsStats.inserted} inserted, ${scrutinsStats.updated} updated, ${scrutinsStats.errors} errors`
		);
		await safeUpdateSyncMetadata('scrutins', scrutinsStats, {
			legislature: config.legislature,
			status: scrutinsStats.errors > 0 ? 'partial' : 'success'
		});

		// Step 5: Import votes
		console.log('\n' + '='.repeat(40));
		console.log('Step 5/7: Importing Votes');
		console.log('='.repeat(40));
		const votesStats = await importVotes(config);
		allStats.votes = votesStats;
		console.log(
			`✓ Votes: ${votesStats.inserted} inserted, ${votesStats.updated} updated, ${votesStats.errors} errors`
		);
		await safeUpdateSyncMetadata('votes', votesStats, {
			legislature: config.legislature,
			status: votesStats.errors > 0 ? 'partial' : 'success'
		});

		// Step 6: Import laws (dossiers législatifs)
		console.log('\n' + '='.repeat(40));
		console.log('Step 6/7: Importing Laws (Dossiers Législatifs)');
		console.log('='.repeat(40));
		const lawsStats = await importLaws(config);
		allStats.laws = lawsStats;
		console.log(
			`✓ Laws: ${lawsStats.inserted} inserted, ${lawsStats.updated} updated, ${lawsStats.errors} errors`
		);
		await safeUpdateSyncMetadata('laws', lawsStats, {
			legislature: config.legislature,
			status: lawsStats.errors > 0 ? 'partial' : 'success'
		});

		// Step 7: Link scrutins to laws
		console.log('\n' + '='.repeat(40));
		console.log('Step 7/7: Linking Scrutins to Laws');
		console.log('='.repeat(40));
		const linkStats = await linkScrutinsToLaws(config);
		allStats.scrutinLawLinks = linkStats;
		console.log(
			`✓ Links: ${linkStats.updated} scrutins linked, ${linkStats.skipped} not found, ${linkStats.errors} errors`
		);

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);

		console.log('\n' + '='.repeat(60));
		console.log('IMPORT SUMMARY');
		console.log('='.repeat(60));
		console.log(
			`  Organs:   ${organsStats.inserted} inserted, ${organsStats.updated} updated (${organsStats.errors} errors)`
		);
		console.log(
			`  Actors:   ${actorsStats.inserted} inserted, ${actorsStats.updated} updated (${actorsStats.errors} errors)`
		);
		console.log(
			`  Mandates: ${mandatesStats.inserted} inserted, ${mandatesStats.updated} updated (${mandatesStats.errors} errors)`
		);
		console.log(
			`  Scrutins: ${scrutinsStats.inserted} inserted, ${scrutinsStats.updated} updated (${scrutinsStats.errors} errors)`
		);
		console.log(
			`  Votes:    ${votesStats.inserted} inserted, ${votesStats.updated} updated (${votesStats.errors} errors)`
		);
		console.log(
			`  Laws:     ${lawsStats.inserted} inserted, ${lawsStats.updated} updated (${lawsStats.errors} errors)`
		);
		console.log(`  Links:    ${linkStats.updated} scrutins linked to laws`);
		console.log('');
		console.log(`Total time: ${duration}s`);
		console.log(`Mode: ${config.incremental ? 'INCREMENTAL' : 'FULL'}`);
		console.log('='.repeat(60));

		const combinedStats: ImportStats = {
			total: Object.values(allStats).reduce((sum, s) => sum + s.total, 0),
			inserted: Object.values(allStats).reduce((sum, s) => sum + s.inserted, 0),
			updated: Object.values(allStats).reduce((sum, s) => sum + s.updated, 0),
			skipped: Object.values(allStats).reduce((sum, s) => sum + s.skipped, 0),
			errors: Object.values(allStats).reduce((sum, s) => sum + s.errors, 0)
		};
		await notifyETLComplete('import-all', combinedStats, {
			legislature: config.legislature,
			additionalInfo: { duration, mode: config.incremental ? 'incremental' : 'full' }
		});
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}

	process.exit(0);
}

main();
