import { db, actorStats, actors } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { eq, and } from 'drizzle-orm';
import { actorStatsUpsertConfig } from '../../utils';

const NOSDEPUTES_API_URL = 'https://www.nosdeputes.fr/synthese/data/json';

interface NosDeputesDepute {
	depute: {
		id: number;
		id_an: string;
		slug: string;
		nom: string;
		semaines_presence?: number;
		commission_presences?: number;
		commission_interventions?: number;
		hemicycle_interventions?: number;
		hemicycle_interventions_courtes?: number;
		amendements_signes?: number;
		amendements_adoptes?: number;
		rapports?: number;
		propositions_ecrites?: number;
		propositions_signees?: number;
		questions_ecrites?: number;
		questions_orales?: number;
	};
}

interface NosDeputesResponse {
	deputes: NosDeputesDepute[];
}

/**
 * Import activity statistics from NosDéputés.fr
 * Maps to existing actors using AN actor ID (PA + id_an)
 */
export async function importNosDeputesActivityStats(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[NosDéputés Stats] Fetching activity statistics...');

	try {
		const response = await fetch(NOSDEPUTES_API_URL);
		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}

		const data: NosDeputesResponse = await response.json();
		console.log(`[NosDéputés Stats] Found ${data.deputes.length} deputies in API`);
		stats.total = data.deputes.length;

		// Get existing AN actors for mapping
		const existingActors = await db
			.select({ id: actors.id, uid: actors.uid })
			.from(actors)
			.where(eq(actors.chamber, 'AN'));

		// Create a map from uid to actor id
		const uidToActorId = new Map<string, string>();
		for (const actor of existingActors) {
			if (actor.uid) {
				uidToActorId.set(actor.uid, actor.id);
			}
		}
		console.log(`[NosDéputés Stats] Found ${uidToActorId.size} AN actors in database`);

		const statsBatch: Array<{
			actorId: string;
			source: string;
			weeksPresent: number;
			commissionPresences: number;
			hemicycleInterventions: number;
			hemicycleShortInterventions: number;
			commissionInterventions: number;
			amendmentsSigned: number;
			amendmentsAdopted: number;
			reports: number;
			writtenProposals: number;
			signedProposals: number;
			writtenQuestions: number;
			oralQuestions: number;
		}> = [];

		for (const item of data.deputes) {
			const d = item.depute;

			// Try to find the actor in our database using uid (id_an directly)
			const uid = d.id_an;
			const actorId = uidToActorId.get(uid);

			if (!actorId) {
				stats.skipped++;
				continue;
			}

			statsBatch.push({
				actorId,
				source: 'nosdeputes',
				weeksPresent: d.semaines_presence ?? 0,
				commissionPresences: d.commission_presences ?? 0,
				hemicycleInterventions: d.hemicycle_interventions ?? 0,
				hemicycleShortInterventions: d.hemicycle_interventions_courtes ?? 0,
				commissionInterventions: d.commission_interventions ?? 0,
				amendmentsSigned: d.amendements_signes ?? 0,
				amendmentsAdopted: d.amendements_adoptes ?? 0,
				reports: d.rapports ?? 0,
				writtenProposals: d.propositions_ecrites ?? 0,
				signedProposals: d.propositions_signees ?? 0,
				writtenQuestions: d.questions_ecrites ?? 0,
				oralQuestions: d.questions_orales ?? 0
			});
		}

		console.log(`[NosDéputés Stats] Matched ${statsBatch.length} deputies to database`);

		// Upsert in batches
		const BATCH_SIZE = 100;
		for (let i = 0; i < statsBatch.length; i += BATCH_SIZE) {
			const batch = statsBatch.slice(i, i + BATCH_SIZE);
			await db.insert(actorStats).values(batch).onConflictDoUpdate(actorStatsUpsertConfig);
			stats.inserted += batch.length;
		}

		console.log(
			`[NosDéputés Stats] Complete: ${stats.inserted} imported, ${stats.skipped} skipped`
		);
	} catch (error) {
		console.error('[NosDéputés Stats] Error:', error);
		stats.errors++;
	}

	return stats;
}
