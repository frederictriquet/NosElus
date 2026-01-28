import { db, actors, organs, scrutins, votes } from '../../../db';
import { fetchDeputes, fetchGroupes, fetchScrutins, fetchScrutinVotes } from './api';
import { mapDepute, mapGroupe, mapScrutin, mapVote } from './mappers';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';

export async function importDeputesFromNosdeputes(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[NosDéputés] Fetching députés...');
	const deputes = await fetchDeputes(config.legislature);
	console.log(`[NosDéputés] Found ${deputes.length} députés`);

	stats.total = deputes.length;

	const batchSize = config.batchSize;
	for (let i = 0; i < deputes.length; i += batchSize) {
		const batch = deputes.slice(i, i + batchSize);
		const mappedActors = batch.map(mapDepute);

		try {
			await db
				.insert(actors)
				.values(mappedActors)
				.onConflictDoUpdate({
					target: actors.id,
					set: {
						firstName: sql`excluded.first_name`,
						lastName: sql`excluded.last_name`,
						fullName: sql`excluded.full_name`,
						profession: sql`excluded.profession`,
						photoUrl: sql`excluded.photo_url`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[NosDéputés] Error inserting batch:`, error);
			stats.errors += batch.length;
		}
	}

	logProgress(stats, 'Députés');
	return stats;
}

export async function importGroupesFromNosdeputes(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[NosDéputés] Fetching groupes parlementaires...');
	const groupes = await fetchGroupes(config.legislature);
	console.log(`[NosDéputés] Found ${groupes.length} groupes`);

	stats.total = groupes.length;

	const mappedOrgans = groupes.map(g => mapGroupe(g, config.legislature));

	try {
		await db
			.insert(organs)
			.values(mappedOrgans)
			.onConflictDoUpdate({
				target: organs.id,
				set: {
					name: sql`excluded.name`,
					shortName: sql`excluded.short_name`,
					color: sql`excluded.color`,
					updatedAt: sql`now()`
				}
			});

		stats.inserted = groupes.length;
	} catch (error) {
		console.error(`[NosDéputés] Error inserting groupes:`, error);
		stats.errors = groupes.length;
	}

	logProgress(stats, 'Groupes');
	return stats;
}

export async function importScrutinsFromNosdeputes(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[NosDéputés] Fetching scrutins...');
	const scrutinsList = await fetchScrutins(config.legislature);
	console.log(`[NosDéputés] Found ${scrutinsList.length} scrutins`);

	stats.total = scrutinsList.length;

	const batchSize = config.batchSize;
	for (let i = 0; i < scrutinsList.length; i += batchSize) {
		const batch = scrutinsList.slice(i, i + batchSize);
		const mappedScrutins = batch.map(s => mapScrutin(s, config.legislature));

		try {
			await db
				.insert(scrutins)
				.values(mappedScrutins)
				.onConflictDoUpdate({
					target: scrutins.id,
					set: {
						title: sql`excluded.title`,
						totalVoters: sql`excluded.total_voters`,
						totalFor: sql`excluded.total_for`,
						totalAgainst: sql`excluded.total_against`,
						totalAbstention: sql`excluded.total_abstention`,
						result: sql`excluded.result`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[NosDéputés] Error inserting scrutins:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 100 === 0) {
			logProgress(stats, 'Scrutins');
		}
	}

	logProgress(stats, 'Scrutins');
	return stats;
}

export async function importVotesFromNosdeputes(
	config: ETLConfig,
	maxScrutins?: number
): Promise<ImportStats> {
	const stats = createImportStats();

	// First, build a map of député slug -> actor ID
	console.log('[NosDéputés] Building député slug map...');
	const deputes = await fetchDeputes(config.legislature);
	const slugToId = new Map<string, string>();
	for (const d of deputes) {
		slugToId.set(d.slug, `PA${d.id_an || d.id}`);
	}

	console.log('[NosDéputés] Fetching scrutins for votes...');
	let scrutinsList = await fetchScrutins(config.legislature);

	// Limit if specified
	if (maxScrutins) {
		scrutinsList = scrutinsList.slice(0, maxScrutins);
	}

	console.log(`[NosDéputés] Will import votes for ${scrutinsList.length} scrutins`);

	let processedScrutins = 0;

	for (const scrutin of scrutinsList) {
		const scrutinId = `VTANR5L${config.legislature}-${scrutin.numero}`;

		try {
			const scrutinVotes = await fetchScrutinVotes(parseInt(scrutin.numero, 10), config.legislature);

			if (scrutinVotes.length > 0) {
				const mappedVotes = scrutinVotes
					.map((v) => mapVote(scrutinId, v, slugToId))
					.filter((v): v is NonNullable<typeof v> => v !== null);

				stats.total += scrutinVotes.length;

				if (mappedVotes.length > 0) {
					// Insert in batches
					for (let i = 0; i < mappedVotes.length; i += config.batchSize) {
						const batch = mappedVotes.slice(i, i + config.batchSize);
						await db.insert(votes).values(batch).onConflictDoNothing();
						stats.inserted += batch.length;
					}
				}
			}
		} catch (error) {
			console.error(`[NosDéputés] Error fetching votes for scrutin ${scrutin.numero}:`, error);
			stats.errors++;
		}

		processedScrutins++;
		if (processedScrutins % 10 === 0) {
			console.log(`[Votes] Processed ${processedScrutins}/${scrutinsList.length} scrutins`);
		}

		// Rate limiting - wait 100ms between requests
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	logProgress(stats, 'Votes');
	return stats;
}
