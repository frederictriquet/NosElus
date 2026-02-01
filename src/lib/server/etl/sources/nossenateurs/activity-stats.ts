import { db, actors, actorStats } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql, eq } from 'drizzle-orm';
import type { NewActorStats } from '../../../db';

const NOSSENATEURS_API_URL = 'https://archive.nossenateurs.fr/synthese/data/json';

interface NosSenateursParliamentaire {
	id: number;
	nom: string;
	nom_de_famille: string;
	prenom: string;
	sexe: string;
	date_naissance: string;
	slug: string;
	id_institution: string; // ex: "allizard_pascal14133k"
	url_institution: string;
	groupe_sigle: string | null;
	semaines_presence: number;
	commission_presences: string | number;
	commission_interventions: string | number;
	hemicycle_interventions: string | number;
	hemicycle_interventions_courtes: string | number;
	amendements_signes: string | number;
	amendements_adoptes: string | number;
	rapports: string | number;
	propositions_ecrites: string | number;
	propositions_signees: string | number;
	questions_ecrites: string | number;
	questions_orales: string | number;
}

interface NosSenateursResponse {
	parlementaires: Array<{
		parlementaire: NosSenateursParliamentaire;
	}>;
}

/**
 * Convert string or number to integer
 */
function toInt(value: string | number | undefined): number {
	if (value === undefined || value === null) return 0;
	if (typeof value === 'number') return value;
	const parsed = parseInt(value, 10);
	return isNaN(parsed) ? 0 : parsed;
}

/**
 * Find actor ID by matching name with existing senators
 */
async function findActorIdByName(
	firstName: string,
	lastName: string,
	senatorMap: Map<string, string>
): Promise<string | null> {
	// Normalize names for matching
	const normalizedKey = `${firstName.toLowerCase().trim()}-${lastName.toLowerCase().trim()}`;

	if (senatorMap.has(normalizedKey)) {
		return senatorMap.get(normalizedKey)!;
	}

	// Try without accents
	const normalizedKeyNoAccent = normalizedKey
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

	for (const [key, id] of senatorMap.entries()) {
		const keyNoAccent = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		if (keyNoAccent === normalizedKeyNoAccent) {
			return id;
		}
	}

	return null;
}

/**
 * Import activity statistics from NosSénateurs.fr archive
 */
export async function importNosSenateursStats(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[NosSenateurs Stats] Fetching from API...');

	const response = await fetch(NOSSENATEURS_API_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch NosSenateurs data: ${response.status} ${response.statusText}`);
	}

	const data: NosSenateursResponse = await response.json();
	const parlementaires = data.parlementaires.map((p) => p.parlementaire);

	console.log(`[NosSenateurs Stats] Found ${parlementaires.length} parlementaires`);

	// Filter to only those with some activity
	const activeParlementaires = parlementaires.filter(
		(p) =>
			p.semaines_presence > 0 ||
			toInt(p.commission_presences) > 0 ||
			toInt(p.hemicycle_interventions) > 0
	);

	console.log(`[NosSenateurs Stats] ${activeParlementaires.length} with activity data`);
	stats.total = activeParlementaires.length;

	// Build a map of existing senators for matching
	const existingSenators = await db
		.select({ id: actors.id, firstName: actors.firstName, lastName: actors.lastName })
		.from(actors)
		.where(eq(actors.chamber, 'SENAT'));

	const senatorMap = new Map<string, string>();
	for (const senator of existingSenators) {
		const key = `${senator.firstName.toLowerCase().trim()}-${senator.lastName.toLowerCase().trim()}`;
		senatorMap.set(key, senator.id);
	}

	console.log(`[NosSenateurs Stats] Found ${existingSenators.length} existing senators in DB`);

	// Process and insert stats
	const batchSize = config.batchSize;
	const statsToInsert: NewActorStats[] = [];

	for (const p of activeParlementaires) {
		const actorId = await findActorIdByName(p.prenom, p.nom_de_famille, senatorMap);

		if (!actorId) {
			stats.skipped++;
			continue;
		}

		statsToInsert.push({
			actorId,
			source: 'nossenateurs',
			weeksPresent: p.semaines_presence,
			commissionPresences: toInt(p.commission_presences),
			hemicycleInterventions: toInt(p.hemicycle_interventions),
			hemicycleShortInterventions: toInt(p.hemicycle_interventions_courtes),
			commissionInterventions: toInt(p.commission_interventions),
			amendmentsSigned: toInt(p.amendements_signes),
			amendmentsAdopted: toInt(p.amendements_adoptes),
			reports: toInt(p.rapports),
			writtenProposals: toInt(p.propositions_ecrites),
			signedProposals: toInt(p.propositions_signees),
			writtenQuestions: toInt(p.questions_ecrites),
			oralQuestions: toInt(p.questions_orales)
		});
	}

	console.log(`[NosSenateurs Stats] Matched ${statsToInsert.length} senators`);

	// Insert in batches
	for (let i = 0; i < statsToInsert.length; i += batchSize) {
		const batch = statsToInsert.slice(i, i + batchSize);

		try {
			await db
				.insert(actorStats)
				.values(batch)
				.onConflictDoUpdate({
					target: [actorStats.actorId, actorStats.source],
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
			console.error(`[NosSenateurs Stats] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 100 === 0 || i + batchSize >= statsToInsert.length) {
			logProgress(stats, 'NosSenateurs Stats');
		}
	}

	console.log(
		`[NosSenateurs Stats] Import complete: ${stats.inserted} inserted, ${stats.skipped} skipped (no match), ${stats.errors} errors`
	);

	return stats;
}
