import { db, actors, actorStats } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql, eq } from 'drizzle-orm';
import type { NewActorStats } from '../../../db';

const SENAT_CALENDAR_BASE_URL = 'https://www.senat.fr/calendrier_activite/json';
const SENAT_ACTIVE_SENATORS_URL = `${SENAT_CALENDAR_BASE_URL}/liste_actifs.json`;

interface SenatActiveSenator {
	matricule: string;
	qualite: string;
	nomUsuel: string;
	prenomUsuel: string;
	nomTechnique: string;
	groupePolitiqueCourant: string;
	baseNotice: string;
	evtPlusRecent: string | null;
	mandats: Array<{ debut: string; fin: string | null }>;
}

interface SenatActivityEvent {
	title: string;
	start: string;
	end: string;
	url: string;
	className: string;
	libelle: string | null;
	allDay: boolean;
}

interface AggregatedStats {
	seancesPlenieres: number;
	commissionPresences: number;
	questionsGouvernement: number;
	votes: number;
	missions: number;
	delegations: number;
	other: number;
}

/**
 * Get the year from an event date string
 */
function getEventYear(dateStr: string): string {
	return dateStr.slice(0, 4);
}

/**
 * Aggregate activity events into stats, grouped by year
 */
function aggregateEventsByYear(events: SenatActivityEvent[]): Map<string, AggregatedStats> {
	const statsByYear = new Map<string, AggregatedStats>();

	for (const event of events) {
		const year = getEventYear(event.start);

		if (!statsByYear.has(year)) {
			statsByYear.set(year, {
				seancesPlenieres: 0,
				commissionPresences: 0,
				questionsGouvernement: 0,
				votes: 0,
				missions: 0,
				delegations: 0,
				other: 0
			});
		}

		const stats = statsByYear.get(year)!;
		const className = event.className || '';
		const title = event.title || '';

		if (className.includes('SEANCE_PLENIERE')) {
			stats.seancesPlenieres++;
			if (title.includes('Questions')) {
				stats.questionsGouvernement++;
			}
			if (title.includes('Scrutin') || title.includes('vote')) {
				stats.votes++;
			}
		} else if (className.includes('COM_PERMANENTE') || className.includes('COM_SPECIALE')) {
			stats.commissionPresences++;
		} else if (className.includes('MISSION')) {
			stats.missions++;
		} else if (className.includes('DELEGATION') || className.includes('OFFICE')) {
			stats.delegations++;
		} else {
			stats.other++;
		}
	}

	return statsByYear;
}

/**
 * Aggregate all events into a single stats object (for 'all' period)
 */
function aggregateEvents(events: SenatActivityEvent[]): AggregatedStats {
	const stats: AggregatedStats = {
		seancesPlenieres: 0,
		commissionPresences: 0,
		questionsGouvernement: 0,
		votes: 0,
		missions: 0,
		delegations: 0,
		other: 0
	};

	for (const event of events) {
		const className = event.className || '';
		const title = event.title || '';

		if (className.includes('SEANCE_PLENIERE')) {
			stats.seancesPlenieres++;
			if (title.includes('Questions')) {
				stats.questionsGouvernement++;
			}
			if (title.includes('Scrutin') || title.includes('vote')) {
				stats.votes++;
			}
		} else if (className.includes('COM_PERMANENTE') || className.includes('COM_SPECIALE')) {
			stats.commissionPresences++;
		} else if (className.includes('MISSION')) {
			stats.missions++;
		} else if (className.includes('DELEGATION') || className.includes('OFFICE')) {
			stats.delegations++;
		} else {
			stats.other++;
		}
	}

	return stats;
}

/**
 * Find actor ID by matching matricule with existing senators
 */
async function findActorIdByMatricule(
	matricule: string,
	senatorMap: Map<string, string>
): Promise<string | null> {
	// The senat.fr matricule is stored as uid in our actors table
	const normalizedMatricule = matricule.toUpperCase();

	if (senatorMap.has(normalizedMatricule)) {
		return senatorMap.get(normalizedMatricule)!;
	}

	return null;
}

/**
 * Import activity statistics from official Senat calendar API
 */
export async function importSenatActivityStats(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[Senat Activity Stats] Fetching senators list...');

	// Fetch list of senators with activity data
	const listResponse = await fetch(SENAT_ACTIVE_SENATORS_URL);
	if (!listResponse.ok) {
		throw new Error(
			`Failed to fetch senators list: ${listResponse.status} ${listResponse.statusText}`
		);
	}

	const senators: SenatActiveSenator[] = await listResponse.json();
	// Skip header row
	const validSenators = senators.filter(
		(s) => s.matricule && s.matricule !== 'Fichier JSON' && !s.matricule.startsWith('Fichier')
	);

	console.log(`[Senat Activity Stats] Found ${validSenators.length} senators with data`);

	// Filter to only senators with recent activity
	const activeSenators = validSenators.filter((s) => s.evtPlusRecent);
	console.log(`[Senat Activity Stats] ${activeSenators.length} with recent activity`);
	stats.total = activeSenators.length;

	// Build a map of existing senators by uid (matricule)
	const existingSenators = await db
		.select({ id: actors.id, uid: actors.uid })
		.from(actors)
		.where(eq(actors.chamber, 'SENAT'));

	const senatorMap = new Map<string, string>();
	for (const senator of existingSenators) {
		if (senator.uid) {
			senatorMap.set(senator.uid.toUpperCase(), senator.id);
		}
	}

	console.log(`[Senat Activity Stats] Found ${existingSenators.length} existing senators in DB`);

	// Process senators and fetch their activity data
	const batchSize = config.batchSize;
	const statsToInsert: NewActorStats[] = [];
	let processed = 0;

	for (const senator of activeSenators) {
		const actorId = await findActorIdByMatricule(senator.matricule, senatorMap);

		if (!actorId) {
			stats.skipped++;
			processed++;
			continue;
		}

		try {
			// Fetch activity events for this senator
			const activityUrl = `${SENAT_CALENDAR_BASE_URL}/sen_${senator.matricule}.json`;
			const activityResponse = await fetch(activityUrl);

			if (!activityResponse.ok) {
				stats.skipped++;
				processed++;
				continue;
			}

			const events: SenatActivityEvent[] = await activityResponse.json();

			// Aggregate by year for period-specific stats
			const statsByYear = aggregateEventsByYear(events);
			for (const [year, yearStats] of statsByYear) {
				statsToInsert.push({
					actorId,
					source: 'senat',
					period: year,
					weeksPresent: Math.ceil(yearStats.seancesPlenieres / 3),
					commissionPresences: yearStats.commissionPresences,
					hemicycleInterventions: yearStats.seancesPlenieres,
					hemicycleShortInterventions: 0,
					commissionInterventions: 0,
					amendmentsSigned: 0,
					amendmentsAdopted: 0,
					reports: yearStats.missions,
					writtenProposals: 0,
					signedProposals: 0,
					writtenQuestions: 0,
					oralQuestions: yearStats.questionsGouvernement
				});
			}

			// Also store 'all' period for total stats
			const allStats = aggregateEvents(events);
			statsToInsert.push({
				actorId,
				source: 'senat',
				period: 'all',
				weeksPresent: Math.ceil(allStats.seancesPlenieres / 3),
				commissionPresences: allStats.commissionPresences,
				hemicycleInterventions: allStats.seancesPlenieres,
				hemicycleShortInterventions: 0,
				commissionInterventions: 0,
				amendmentsSigned: 0,
				amendmentsAdopted: 0,
				reports: allStats.missions,
				writtenProposals: 0,
				signedProposals: 0,
				writtenQuestions: 0,
				oralQuestions: allStats.questionsGouvernement
			});
		} catch (error) {
			console.error(
				`[Senat Activity Stats] Error fetching activity for ${senator.matricule}:`,
				error
			);
			stats.errors++;
		}

		processed++;
		if (processed % 50 === 0) {
			console.log(`[Senat Activity Stats] Processed ${processed}/${activeSenators.length}`);
		}

		// Small delay to avoid overwhelming the server
		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	console.log(`[Senat Activity Stats] Matched ${statsToInsert.length} senators`);

	// Insert in batches
	for (let i = 0; i < statsToInsert.length; i += batchSize) {
		const batch = statsToInsert.slice(i, i + batchSize);

		try {
			await db
				.insert(actorStats)
				.values(batch)
				.onConflictDoUpdate({
					target: [actorStats.actorId, actorStats.source, actorStats.period],
					set: {
						weeksPresent: sql`excluded.weeks_present`,
						commissionPresences: sql`excluded.commission_presences`,
						hemicycleInterventions: sql`excluded.hemicycle_interventions`,
						hemicycleShortInterventions: sql`excluded.hemicycle_short_interventions`,
						commissionInterventions: sql`excluded.commission_interventions`,
						amendmentsSigned: sql`excluded.amendments_signed`,
						amendmentsAdopted: sql`excluded.amendments_adopted`,
						reports: sql`excluded.reports`,
						writtenProposals: sql`excluded.written_proposals`,
						signedProposals: sql`excluded.signed_proposals`,
						writtenQuestions: sql`excluded.written_questions`,
						oralQuestions: sql`excluded.oral_questions`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[Senat Activity Stats] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 100 === 0 || i + batchSize >= statsToInsert.length) {
			logProgress(stats, 'Senat Activity Stats');
		}
	}

	console.log(
		`[Senat Activity Stats] Import complete: ${stats.inserted} inserted, ${stats.skipped} skipped (no match), ${stats.errors} errors`
	);

	return stats;
}
