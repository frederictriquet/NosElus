import { db, actors, organs, scrutins, votes, mandates } from '../../../db';
import { fetchDeputes, fetchGroupes, fetchScrutins, fetchScrutinVotes } from './api';
import { mapDepute, mapDeputeMandate, mapGroupe, mapScrutin, mapVote } from './mappers';
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

	// Import mandates (linking deputies to their groups)
	console.log('[NosDéputés] Creating mandates for group memberships...');
	const mappedMandates = deputes
		.map((d) => mapDeputeMandate(d, config.legislature))
		.filter((m): m is NonNullable<typeof m> => m !== null);

	if (mappedMandates.length > 0) {
		for (let i = 0; i < mappedMandates.length; i += batchSize) {
			const batch = mappedMandates.slice(i, i + batchSize);
			try {
				await db
					.insert(mandates)
					.values(batch)
					.onConflictDoUpdate({
						target: mandates.id,
						set: {
							endDate: sql`excluded.end_date`,
							updatedAt: sql`now()`
						}
					});
			} catch (error) {
				console.error(`[NosDéputés] Error inserting mandates:`, error);
			}
		}
		console.log(`[NosDéputés] Created ${mappedMandates.length} group mandates`);
	}

	logProgress(stats, 'Députés');
	return stats;
}

export async function importGroupesFromNosdeputes(
	config: ETLConfig,
	legislatureNumber?: string
): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[NosDéputés] Fetching groupes parlementaires...');
	const groupes = await fetchGroupes(config.legislature);
	console.log(`[NosDéputés] Found ${groupes.length} groupes`);

	stats.total = groupes.length;

	// Use legislatureNumber if provided, otherwise derive from config.legislature
	const actualLegislature = legislatureNumber || config.legislature;
	const mappedOrgans = groupes.map((g) => mapGroupe(g, actualLegislature));

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
		const mappedScrutins = batch.map((s) => mapScrutin(s, config.legislature));

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

	// First, build maps of député slug -> actor ID and slug -> group ID
	console.log('[NosDéputés] Building député slug maps...');
	const deputes = await fetchDeputes(config.legislature);
	const slugToId = new Map<string, string>();
	const slugToGroupId = new Map<string, string>();
	for (const d of deputes) {
		slugToId.set(d.slug, `PA${d.id_an || d.id}`);
		if (d.groupe_sigle) {
			slugToGroupId.set(d.slug, `PO_GP_${d.groupe_sigle}`);
		}
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
			const scrutinVotes = await fetchScrutinVotes(
				parseInt(scrutin.numero, 10),
				config.legislature
			);

			if (scrutinVotes.length > 0) {
				const mappedVotes = scrutinVotes
					.map((v) => mapVote(scrutinId, v, slugToId, slugToGroupId))
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
