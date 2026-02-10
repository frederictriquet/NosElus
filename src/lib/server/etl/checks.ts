/**
 * Configuration des checks ETL pour la page /admin/etl-status
 *
 * Chaque check détecte un manque dans les données et suggère l'ETL approprié.
 */

import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

/** Sévérité d'un check ETL */
export type ETLCheckSeverity = 'critical' | 'warning' | 'info' | 'ok';

/** Chambre concernée par le check */
export type ETLChamber = 'AN' | 'PE' | 'SENAT' | 'ALL';

/** Résultat d'un check ETL */
export interface ETLCheckResult {
	/** ID unique du check */
	id: string;
	/** Label affiché (ex: "Lois AN sans résumé IA") */
	label: string;
	/** Description courte du problème */
	description: string;
	/** Sévérité (détermine couleur badge) */
	severity: ETLCheckSeverity;
	/** Nombre d'entités manquantes/problématiques */
	current: number;
	/** Nombre total d'entités */
	total: number;
	/** Pourcentage manquant */
	pct: number;
	/** Commande Makefile suggérée */
	command: string;
	/** Chambre(s) concernée(s) */
	chamber: ETLChamber;
}

/** État d'une synchronisation ETL */
export interface SyncStatusRow {
	source: string;
	entityType: string;
	lastSyncAt: Date;
	lastSyncStatus: string;
	daysSinceSync: number;
	recordsProcessed: number;
}

/**
 * MIN_DESCRIPTION_LENGTH : Seuil pour considérer une description comme "texte complet".
 * Réutilise la définition partagée du projet.
 *
 * @see src/lib/server/db/constants.ts
 * @see .serena/memories/std-shared-data-definitions.md
 */
export const MIN_DESCRIPTION_LENGTH = 100;

/**
 * Charge l'état des dernières synchronisations ETL depuis sync_metadata.
 *
 * Retourne les N syncs les plus récentes avec l'âge en jours.
 *
 * @returns Array de statuts de sync, triés par date décroissante
 */
export async function loadSyncStatus(): Promise<SyncStatusRow[]> {
	const result = await db.execute<{
		source: string;
		entity_type: string;
		last_sync_at: Date;
		last_sync_status: string;
		days_since: number;
		records_processed: number;
	}>(sql`
		SELECT
			source,
			entity_type,
			last_sync_at,
			last_sync_status,
			EXTRACT(DAY FROM NOW() - last_sync_at)::integer as days_since,
			records_processed
		FROM sync_metadata
		ORDER BY last_sync_at DESC
		LIMIT 20
	`);

	return result.map((row) => ({
		source: row.source,
		entityType: row.entity_type,
		lastSyncAt: row.last_sync_at,
		lastSyncStatus: row.last_sync_status,
		daysSinceSync: row.days_since,
		recordsProcessed: row.records_processed
	}));
}

/**
 * Exécute tous les checks ETL et retourne les suggestions.
 *
 * **Pattern CTE SQL** : Une seule requête agrège 10+ métriques
 * pour éviter N+1 queries.
 *
 * **Logique de sévérité** :
 * - critical : >30 jours périmé, >50% manquant
 * - warning : 15-30 jours, 25-50% manquant
 * - info : 10-15 jours, 10-25% manquant
 * - ok : <10 jours, <10% manquant
 *
 * @returns Array de suggestions ETL triées par sévérité
 */
export async function loadETLChecks(): Promise<ETLCheckResult[]> {
	const result = await db.execute<{
		// Laws
		total_laws_an: number;
		total_laws_pe: number;
		laws_an_no_fulltext: number;
		laws_pe_no_fulltext: number;
		laws_an_no_summary: number;
		laws_pe_no_summary: number;
		laws_an_no_tags: number;
		// Scrutins
		total_scrutins_an: number;
		scrutins_an_no_law: number;
		// Actors
		total_actors_an: number;
		total_actors_pe: number;
		total_actors_senat: number;
		actors_an_no_stats: number;
		actors_pe_no_stats: number;
		actors_senat_no_stats: number;
		// Sync freshness
		last_sync_an_days: number | null;
		last_sync_pe_days: number | null;
	}>(sql`
		WITH
		law_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$') as total_laws_an,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%') as total_laws_pe,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND (description IS NULL OR length(description) <= ${MIN_DESCRIPTION_LENGTH})) as laws_an_no_fulltext,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%'
					AND (description IS NULL OR length(description) <= ${MIN_DESCRIPTION_LENGTH})) as laws_pe_no_fulltext,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND description IS NOT NULL
					AND length(description) > ${MIN_DESCRIPTION_LENGTH}
					AND NOT EXISTS (SELECT 1 FROM law_summaries ls WHERE ls.law_id = l.id)) as laws_an_no_summary,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%'
					AND description IS NOT NULL
					AND length(description) > ${MIN_DESCRIPTION_LENGTH}
					AND NOT EXISTS (SELECT 1 FROM law_summaries ls WHERE ls.law_id = l.id)) as laws_pe_no_summary,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND NOT EXISTS (SELECT 1 FROM law_tags lt WHERE lt.law_id = l.id)) as laws_an_no_tags
			FROM laws l
		),
		scrutin_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$') as total_scrutins_an,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND law_id IS NULL) as scrutins_an_no_law
			FROM scrutins
		),
		actor_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE chamber = 'AN') as total_actors_an,
				COUNT(*) FILTER (WHERE chamber = 'PE') as total_actors_pe,
				COUNT(*) FILTER (WHERE chamber = 'SENAT') as total_actors_senat,
				COUNT(*) FILTER (WHERE chamber = 'AN'
					AND NOT EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id)) as actors_an_no_stats,
				COUNT(*) FILTER (WHERE chamber = 'PE'
					AND NOT EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id)) as actors_pe_no_stats,
				COUNT(*) FILTER (WHERE chamber = 'SENAT'
					AND NOT EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id)) as actors_senat_no_stats
			FROM actors a
		),
		sync_freshness AS (
			SELECT
				EXTRACT(DAY FROM NOW() - MAX(last_sync_at) FILTER (WHERE source = 'assemblee'))::integer as last_sync_an_days,
				EXTRACT(DAY FROM NOW() - MAX(last_sync_at) FILTER (WHERE source = 'europarl'))::integer as last_sync_pe_days
			FROM sync_metadata
		)
		SELECT
			ls.*,
			ss.*,
			ast.*,
			sf.*
		FROM law_stats ls, scrutin_stats ss, actor_stats ast, sync_freshness sf
	`);

	const row = result[0];
	const checks: ETLCheckResult[] = [];

	// Check 1: Fraîcheur données AN
	const daysSinceAN = row.last_sync_an_days ?? 999;
	checks.push({
		id: 'stale-an-data',
		label: 'Fraîcheur données AN',
		description:
			daysSinceAN > 30
				? `Dernière sync il y a ${daysSinceAN} jours (>30j)`
				: `Dernière sync il y a ${daysSinceAN} jours`,
		severity: daysSinceAN > 30 ? 'critical' : daysSinceAN > 15 ? 'warning' : 'ok',
		current: daysSinceAN,
		total: 30,
		pct: Math.min(100, (daysSinceAN / 30) * 100),
		command: 'make etl-an-incremental',
		chamber: 'AN'
	});

	// Check 2: Fraîcheur données PE
	const daysSincePE = row.last_sync_pe_days ?? 999;
	checks.push({
		id: 'stale-pe-data',
		label: 'Fraîcheur données PE',
		description:
			daysSincePE > 30
				? `Dernière sync il y a ${daysSincePE} jours (>30j)`
				: `Dernière sync il y a ${daysSincePE} jours`,
		severity: daysSincePE > 30 ? 'critical' : daysSincePE > 15 ? 'warning' : 'ok',
		current: daysSincePE,
		total: 30,
		pct: Math.min(100, (daysSincePE / 30) * 100),
		command: 'make etl-europarl-votes',
		chamber: 'PE'
	});

	// Check 3: Lois AN sans texte complet
	const lawsANNoFulltext = Number(row.laws_an_no_fulltext) || 0;
	const totalLawsAN = Number(row.total_laws_an) || 0;
	const pctANNoFulltext = totalLawsAN > 0 ? (lawsANNoFulltext / totalLawsAN) * 100 : 0;
	checks.push({
		id: 'laws-an-no-fulltext',
		label: 'Lois AN sans texte complet',
		description: `${lawsANNoFulltext} lois sans description >100 caractères`,
		severity: pctANNoFulltext > 50 ? 'critical' : pctANNoFulltext > 25 ? 'warning' : 'info',
		current: lawsANNoFulltext,
		total: totalLawsAN,
		pct: pctANNoFulltext,
		command: 'make etl-law-texts',
		chamber: 'AN'
	});

	// Check 4: Lois PE sans texte complet
	const lawsPENoFulltext = Number(row.laws_pe_no_fulltext) || 0;
	const totalLawsPE = Number(row.total_laws_pe) || 0;
	const pctPENoFulltext = totalLawsPE > 0 ? (lawsPENoFulltext / totalLawsPE) * 100 : 0;
	checks.push({
		id: 'laws-pe-no-fulltext',
		label: 'Lois PE sans texte complet',
		description: `${lawsPENoFulltext} lois sans description >100 caractères`,
		severity: pctPENoFulltext > 50 ? 'critical' : pctPENoFulltext > 25 ? 'warning' : 'info',
		current: lawsPENoFulltext,
		total: totalLawsPE,
		pct: pctPENoFulltext,
		command: 'make etl-europarl-law-texts',
		chamber: 'PE'
	});

	// Check 5: Lois AN sans résumé IA
	const lawsANNoSummary = Number(row.laws_an_no_summary) || 0;
	const totalLawsANWithText = totalLawsAN - lawsANNoFulltext;
	const pctANNoSummary =
		totalLawsANWithText > 0 ? (lawsANNoSummary / totalLawsANWithText) * 100 : 0;
	checks.push({
		id: 'laws-an-no-ai-summary',
		label: 'Lois AN sans résumé IA',
		description: `${lawsANNoSummary} lois avec texte mais sans analyse LLM`,
		severity: pctANNoSummary > 50 ? 'warning' : pctANNoSummary > 25 ? 'info' : 'ok',
		current: lawsANNoSummary,
		total: totalLawsANWithText,
		pct: pctANNoSummary,
		command: 'make etl-analyze-laws',
		chamber: 'AN'
	});

	// Check 6: Lois PE sans résumé IA
	const lawsPENoSummary = Number(row.laws_pe_no_summary) || 0;
	const totalLawsPEWithText = totalLawsPE - lawsPENoFulltext;
	const pctPENoSummary =
		totalLawsPEWithText > 0 ? (lawsPENoSummary / totalLawsPEWithText) * 100 : 0;
	checks.push({
		id: 'laws-pe-no-ai-summary',
		label: 'Lois PE sans résumé IA',
		description: `${lawsPENoSummary} lois avec texte mais sans analyse LLM`,
		severity: pctPENoSummary > 50 ? 'warning' : pctPENoSummary > 25 ? 'info' : 'ok',
		current: lawsPENoSummary,
		total: totalLawsPEWithText,
		pct: pctPENoSummary,
		command: 'make etl-analyze-laws',
		chamber: 'PE'
	});

	// Check 7: Lois AN sans tags
	const lawsANNoTags = Number(row.laws_an_no_tags) || 0;
	const pctANNoTags = totalLawsAN > 0 ? (lawsANNoTags / totalLawsAN) * 100 : 0;
	checks.push({
		id: 'laws-an-no-tags',
		label: 'Lois AN sans classification',
		description: `${lawsANNoTags} lois sans tags sémantiques`,
		severity: pctANNoTags > 50 ? 'warning' : pctANNoTags > 25 ? 'info' : 'ok',
		current: lawsANNoTags,
		total: totalLawsAN,
		pct: pctANNoTags,
		command: 'make etl-classify-scrutins',
		chamber: 'AN'
	});

	// Check 8: Scrutins AN sans loi liée
	const scrutinsANNoLaw = Number(row.scrutins_an_no_law) || 0;
	const totalScrutinsAN = Number(row.total_scrutins_an) || 0;
	const pctScrutinsNoLaw = totalScrutinsAN > 0 ? (scrutinsANNoLaw / totalScrutinsAN) * 100 : 0;
	checks.push({
		id: 'scrutins-an-no-law',
		label: 'Scrutins AN non liés',
		description: `${scrutinsANNoLaw} scrutins sans lien vers dossier législatif`,
		severity: pctScrutinsNoLaw > 50 ? 'warning' : pctScrutinsNoLaw > 25 ? 'info' : 'ok',
		current: scrutinsANNoLaw,
		total: totalScrutinsAN,
		pct: pctScrutinsNoLaw,
		command: 'make etl-an-link-laws',
		chamber: 'AN'
	});

	// Check 9: Députés sans stats
	const actorsANNoStats = Number(row.actors_an_no_stats) || 0;
	const totalActorsAN = Number(row.total_actors_an) || 0;
	const pctANNoStats = totalActorsAN > 0 ? (actorsANNoStats / totalActorsAN) * 100 : 0;
	checks.push({
		id: 'actors-an-no-stats',
		label: 'Députés sans stats activité',
		description: `${actorsANNoStats} députés sans statistiques d'activité`,
		severity: pctANNoStats > 50 ? 'warning' : pctANNoStats > 25 ? 'info' : 'ok',
		current: actorsANNoStats,
		total: totalActorsAN,
		pct: pctANNoStats,
		command: 'make etl-an-nosdeputes-stats',
		chamber: 'AN'
	});

	// Check 10: Eurodéputés sans stats
	const actorsPENoStats = Number(row.actors_pe_no_stats) || 0;
	const totalActorsPE = Number(row.total_actors_pe) || 0;
	const pctPENoStats = totalActorsPE > 0 ? (actorsPENoStats / totalActorsPE) * 100 : 0;
	checks.push({
		id: 'actors-pe-no-stats',
		label: 'Eurodéputés sans stats activité',
		description: `${actorsPENoStats} eurodéputés sans statistiques d'activité`,
		severity: pctPENoStats > 50 ? 'info' : pctPENoStats > 25 ? 'info' : 'ok',
		current: actorsPENoStats,
		total: totalActorsPE,
		pct: pctPENoStats,
		command: 'make etl-europarl-activity-stats',
		chamber: 'PE'
	});

	// Check 11: Sénateurs sans stats
	const actorsSENATNoStats = Number(row.actors_senat_no_stats) || 0;
	const totalActorsSENAT = Number(row.total_actors_senat) || 0;
	const pctSENATNoStats = totalActorsSENAT > 0 ? (actorsSENATNoStats / totalActorsSENAT) * 100 : 0;
	checks.push({
		id: 'actors-senat-no-stats',
		label: 'Sénateurs sans stats activité',
		description: `${actorsSENATNoStats} sénateurs sans statistiques d'activité`,
		severity: pctSENATNoStats > 50 ? 'warning' : pctSENATNoStats > 25 ? 'info' : 'ok',
		current: actorsSENATNoStats,
		total: totalActorsSENAT,
		pct: pctSENATNoStats,
		command: 'make etl-senat-activity-stats',
		chamber: 'SENAT'
	});

	// Trier par sévérité puis par pct décroissant
	const severityOrder = { critical: 0, warning: 1, info: 2, ok: 3 };
	return checks.sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.pct - a.pct
	);
}
