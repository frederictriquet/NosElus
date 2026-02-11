/**
 * Configuration des checks ETL pour la page /admin/etl-status
 *
 * Chaque check détecte un manque dans les données et suggère l'ETL approprié.
 * Couvre l'ensemble des ~30 targets Makefile ETL pertinentes.
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
 * **Pattern CTE SQL** : Une seule requête agrège 25+ métriques
 * pour éviter N+1 queries.
 *
 * **Logique de sévérité** :
 * - critical : >30 jours périmé, >50% manquant, 0 entités
 * - warning : 15-30 jours, 25-50% manquant, compteur bas
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
		total_laws_senat: number;
		laws_an_no_fulltext: number;
		laws_pe_no_fulltext: number;
		laws_an_no_summary: number;
		laws_pe_no_summary: number;
		laws_an_no_tags: number;
		total_cosignatories_an: number;
		// Scrutins
		total_scrutins_an: number;
		scrutins_an_with_law: number;
		scrutins_an_with_category: number;
		total_scrutins_pe: number;
		scrutins_pe_with_law: number;
		// Actors
		total_actors_an: number;
		total_actors_pe: number;
		total_actors_senat: number;
		actors_an_with_stats: number;
		actors_pe_with_stats: number;
		actors_senat_with_stats: number;
		actors_pe_no_historical_mandates: number;
		actors_senat_with_nossenateurs: number;
		// Amendments
		total_amendments_an: number;
		// Mandates
		total_mandates_senat: number;
		// Organs
		groups_total: number;
		groups_no_color: number;
		groups_pe_senat_total: number;
		groups_pe_senat_no_color: number;
		groups_no_position: number;
		groups_pe_no_shortname: number;
		groups_pe_total: number;
		// Sync freshness
		last_sync_an_days: number | null;
		last_sync_pe_days: number | null;
		last_sync_senat_days: number | null;
	}>(sql`
		WITH
		law_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND id NOT LIKE 'SEN-%') as total_laws_an,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%') as total_laws_pe,
				COUNT(*) FILTER (WHERE id LIKE 'SEN-%') as total_laws_senat,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND id NOT LIKE 'SEN-%'
					AND (description IS NULL OR length(description) <= ${MIN_DESCRIPTION_LENGTH})) as laws_an_no_fulltext,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%'
					AND (description IS NULL OR length(description) <= ${MIN_DESCRIPTION_LENGTH})) as laws_pe_no_fulltext,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND id NOT LIKE 'SEN-%'
					AND description IS NOT NULL
					AND length(description) > ${MIN_DESCRIPTION_LENGTH}
					AND NOT EXISTS (SELECT 1 FROM law_summaries ls WHERE ls.law_id = l.id)) as laws_an_no_summary,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%'
					AND description IS NOT NULL
					AND length(description) > ${MIN_DESCRIPTION_LENGTH}
					AND NOT EXISTS (SELECT 1 FROM law_summaries ls WHERE ls.law_id = l.id)) as laws_pe_no_summary,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND id NOT LIKE 'SEN-%'
					AND NOT EXISTS (SELECT 1 FROM law_tags lt WHERE lt.law_id = l.id)) as laws_an_no_tags,
				(SELECT COUNT(*) FROM law_cosignatories) as total_cosignatories_an
			FROM laws l
		),
		scrutin_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$') as total_scrutins_an,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND law_id IS NOT NULL) as scrutins_an_with_law,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND category IS NOT NULL) as scrutins_an_with_category,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%') as total_scrutins_pe,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%'
					AND law_id IS NOT NULL) as scrutins_pe_with_law
			FROM scrutins
		),
		actor_counts AS (
			SELECT
				COUNT(*) FILTER (WHERE chamber = 'AN') as total_actors_an,
				COUNT(*) FILTER (WHERE chamber = 'PE') as total_actors_pe,
				COUNT(*) FILTER (WHERE chamber = 'SENAT') as total_actors_senat,
				COUNT(*) FILTER (WHERE chamber = 'AN'
					AND EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id)) as actors_an_with_stats,
				COUNT(*) FILTER (WHERE chamber = 'PE'
					AND EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id)) as actors_pe_with_stats,
				COUNT(*) FILTER (WHERE chamber = 'SENAT'
					AND EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id)) as actors_senat_with_stats,
				COUNT(*) FILTER (WHERE chamber = 'PE'
					AND uid IS NOT NULL
					AND (SELECT COUNT(*) FROM mandates m WHERE m.actor_id = a.id AND m.organ_id LIKE 'GPEU-%') <= 1
				) as actors_pe_no_historical_mandates,
				COUNT(*) FILTER (WHERE chamber = 'SENAT'
					AND EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id AND ast.source = 'nossenateurs')
				) as actors_senat_with_nossenateurs
			FROM actors a
		),
		amendment_stats AS (
			SELECT COUNT(*) as total_amendments_an FROM amendments
		),
		mandate_stats AS (
			SELECT COUNT(*) as total_mandates_senat
			FROM mandates m
			JOIN actors a ON m.actor_id = a.id
			WHERE a.chamber = 'SENAT'
		),
		organ_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE type = 'GP') as groups_total,
				COUNT(*) FILTER (WHERE type = 'GP' AND color IS NULL) as groups_no_color,
				COUNT(*) FILTER (WHERE type = 'GP' AND chamber IN ('PE', 'SENAT')) as groups_pe_senat_total,
				COUNT(*) FILTER (WHERE type = 'GP' AND chamber IN ('PE', 'SENAT') AND color IS NULL) as groups_pe_senat_no_color,
				COUNT(*) FILTER (WHERE type = 'GP' AND political_position IS NULL) as groups_no_position,
				COUNT(*) FILTER (WHERE type = 'GP' AND chamber = 'PE') as groups_pe_total,
				COUNT(*) FILTER (WHERE type = 'GP' AND chamber = 'PE'
					AND (short_name IS NULL OR short_name = '')) as groups_pe_no_shortname
			FROM organs
		),
		sync_freshness AS (
			SELECT
				EXTRACT(DAY FROM NOW() - MAX(last_sync_at) FILTER (WHERE source = 'assemblee'))::integer as last_sync_an_days,
				EXTRACT(DAY FROM NOW() - MAX(last_sync_at) FILTER (WHERE source = 'europarl'))::integer as last_sync_pe_days,
				EXTRACT(DAY FROM NOW() - MAX(last_sync_at) FILTER (WHERE source = 'senat'))::integer as last_sync_senat_days
			FROM sync_metadata
		)
		SELECT
			ls.*,
			ss.*,
			ac.*,
			ams.*,
			ms.*,
			os.*,
			sf.*
		FROM law_stats ls, scrutin_stats ss, actor_counts ac, amendment_stats ams, mandate_stats ms, organ_stats os, sync_freshness sf
	`);

	const row = result[0];
	const checks: ETLCheckResult[] = [];

	// === FRAÎCHEUR DONNÉES ===

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

	// Check 12: Fraîcheur données Sénat
	const daysSinceSenat = row.last_sync_senat_days ?? 999;
	checks.push({
		id: 'stale-senat-data',
		label: 'Fraîcheur données Sénat',
		description:
			daysSinceSenat > 30
				? `Dernière sync il y a ${daysSinceSenat} jours (>30j)`
				: `Dernière sync il y a ${daysSinceSenat} jours`,
		severity: daysSinceSenat > 30 ? 'critical' : daysSinceSenat > 15 ? 'warning' : 'ok',
		current: daysSinceSenat,
		total: 30,
		pct: Math.min(100, (daysSinceSenat / 30) * 100),
		command: 'make etl-senat-senators',
		chamber: 'SENAT'
	});

	// === COMPTEURS D'IMPORT DE BASE ===

	// Check 13: Députés en base
	const totalActorsAN = Number(row.total_actors_an) || 0;
	checks.push({
		id: 'actors-an-count',
		label: 'Députés en base',
		description: totalActorsAN === 0 ? 'Aucun député importé' : `${totalActorsAN} députés en base`,
		severity: totalActorsAN === 0 ? 'critical' : totalActorsAN < 500 ? 'warning' : 'ok',
		current: 0,
		total: totalActorsAN,
		pct: totalActorsAN === 0 ? 100 : 0,
		command: 'make etl-an-actors',
		chamber: 'AN'
	});

	// Check 14: Sénateurs en base
	const totalActorsSENAT = Number(row.total_actors_senat) || 0;
	checks.push({
		id: 'actors-senat-count',
		label: 'Sénateurs en base',
		description:
			totalActorsSENAT === 0 ? 'Aucun sénateur importé' : `${totalActorsSENAT} sénateurs en base`,
		severity: totalActorsSENAT === 0 ? 'critical' : totalActorsSENAT < 300 ? 'warning' : 'ok',
		current: 0,
		total: totalActorsSENAT,
		pct: totalActorsSENAT === 0 ? 100 : 0,
		command: 'make etl-senat-senators',
		chamber: 'SENAT'
	});

	// Check 15: Eurodéputés en base
	const totalActorsPE = Number(row.total_actors_pe) || 0;
	checks.push({
		id: 'actors-pe-count',
		label: 'Eurodéputés en base',
		description:
			totalActorsPE === 0 ? 'Aucun eurodéputé importé' : `${totalActorsPE} eurodéputés en base`,
		severity: totalActorsPE === 0 ? 'critical' : totalActorsPE < 50 ? 'warning' : 'ok',
		current: 0,
		total: totalActorsPE,
		pct: totalActorsPE === 0 ? 100 : 0,
		command: 'make etl-europarl-meps',
		chamber: 'PE'
	});

	// Check 27: Lois AN en base
	const totalLawsANCount = Number(row.total_laws_an) || 0;
	checks.push({
		id: 'laws-an-count',
		label: 'Lois AN en base',
		description:
			totalLawsANCount === 0 ? 'Aucune loi AN importée' : `${totalLawsANCount} lois AN en base`,
		severity: totalLawsANCount === 0 ? 'critical' : totalLawsANCount < 500 ? 'warning' : 'ok',
		current: 0,
		total: totalLawsANCount,
		pct: totalLawsANCount === 0 ? 100 : 0,
		command: 'make etl-an-laws',
		chamber: 'AN'
	});

	// Check 16: Scrutins AN en base
	const totalScrutinsAN = Number(row.total_scrutins_an) || 0;
	checks.push({
		id: 'scrutins-an-count',
		label: 'Scrutins AN en base',
		description:
			totalScrutinsAN === 0 ? 'Aucun scrutin AN importé' : `${totalScrutinsAN} scrutins AN en base`,
		severity: totalScrutinsAN === 0 ? 'critical' : totalScrutinsAN < 100 ? 'warning' : 'ok',
		current: 0,
		total: totalScrutinsAN,
		pct: totalScrutinsAN === 0 ? 100 : 0,
		command: 'make etl-an-scrutins',
		chamber: 'AN'
	});

	// Check 17: Lois Sénat en base
	const totalLawsSenat = Number(row.total_laws_senat) || 0;
	checks.push({
		id: 'laws-senat-count',
		label: 'Lois Sénat en base',
		description:
			totalLawsSenat === 0 ? 'Aucune loi Sénat importée' : `${totalLawsSenat} lois Sénat en base`,
		severity: totalLawsSenat === 0 ? 'critical' : totalLawsSenat < 1000 ? 'warning' : 'ok',
		current: 0,
		total: totalLawsSenat,
		pct: totalLawsSenat === 0 ? 100 : 0,
		command: 'make etl-senat-laws',
		chamber: 'SENAT'
	});

	// Check 28: Scrutins PE en base
	const totalScrutinsPECount = Number(row.total_scrutins_pe) || 0;
	checks.push({
		id: 'scrutins-pe-count',
		label: 'Scrutins PE en base',
		description:
			totalScrutinsPECount === 0
				? 'Aucun scrutin PE importé'
				: `${totalScrutinsPECount} scrutins PE en base`,
		severity:
			totalScrutinsPECount === 0 ? 'critical' : totalScrutinsPECount < 100 ? 'warning' : 'ok',
		current: 0,
		total: totalScrutinsPECount,
		pct: totalScrutinsPECount === 0 ? 100 : 0,
		command: 'make etl-europarl-votes',
		chamber: 'PE'
	});

	// Check 18: Amendements AN en base
	const totalAmendmentsAN = Number(row.total_amendments_an) || 0;
	checks.push({
		id: 'amendments-an-count',
		label: 'Amendements AN en base',
		description:
			totalAmendmentsAN === 0
				? 'Aucun amendement importé'
				: `${totalAmendmentsAN} amendements en base`,
		severity: totalAmendmentsAN === 0 ? 'critical' : totalAmendmentsAN < 10 ? 'warning' : 'ok',
		current: 0,
		total: totalAmendmentsAN,
		pct: totalAmendmentsAN === 0 ? 100 : 0,
		command: 'make etl-an-amendements',
		chamber: 'AN'
	});

	// Check 29: Mandats historiques Sénat
	const totalMandatesSenat = Number(row.total_mandates_senat) || 0;
	checks.push({
		id: 'mandates-senat-count',
		label: 'Mandats historiques Sénat',
		description:
			totalMandatesSenat === 0
				? 'Aucun mandat sénatorial importé'
				: `${totalMandatesSenat} mandats sénatoriaux en base`,
		severity: totalMandatesSenat === 0 ? 'critical' : totalMandatesSenat < 100 ? 'warning' : 'ok',
		current: 0,
		total: totalMandatesSenat,
		pct: totalMandatesSenat === 0 ? 100 : 0,
		command: 'make etl-senat-mandates-history',
		chamber: 'SENAT'
	});

	// === TEXTES & ANALYSES ===

	// Check 3: Lois AN sans texte complet
	const lawsANNoFulltext = Number(row.laws_an_no_fulltext) || 0;
	const totalLawsAN = Number(row.total_laws_an) || 0;
	const pctANNoFulltext = totalLawsAN > 0 ? (lawsANNoFulltext / totalLawsAN) * 100 : 0;
	checks.push({
		id: 'laws-an-no-fulltext',
		label: 'Lois AN avec texte complet',
		description: `${lawsANNoFulltext} lois sans description >100 caractères`,
		severity: pctANNoFulltext > 50 ? 'critical' : pctANNoFulltext > 25 ? 'warning' : 'info',
		current: lawsANNoFulltext,
		total: totalLawsAN,
		pct: pctANNoFulltext,
		command: 'make etl-an-law-texts',
		chamber: 'AN'
	});

	// Check 4: Lois PE sans texte complet
	const lawsPENoFulltext = Number(row.laws_pe_no_fulltext) || 0;
	const totalLawsPE = Number(row.total_laws_pe) || 0;
	const pctPENoFulltext = totalLawsPE > 0 ? (lawsPENoFulltext / totalLawsPE) * 100 : 0;
	checks.push({
		id: 'laws-pe-no-fulltext',
		label: 'Lois PE avec texte complet',
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
		label: 'Lois AN avec résumé (IA)',
		description: `${lawsANNoSummary} lois avec texte mais sans analyse LLM`,
		severity: pctANNoSummary > 50 ? 'warning' : pctANNoSummary > 25 ? 'info' : 'ok',
		current: lawsANNoSummary,
		total: totalLawsANWithText,
		pct: pctANNoSummary,
		command: 'make etl-an-analyze-laws',
		chamber: 'AN'
	});

	// Check 6: Lois PE sans résumé IA
	const lawsPENoSummary = Number(row.laws_pe_no_summary) || 0;
	const totalLawsPEWithText = totalLawsPE - lawsPENoFulltext;
	const pctPENoSummary =
		totalLawsPEWithText > 0 ? (lawsPENoSummary / totalLawsPEWithText) * 100 : 0;
	checks.push({
		id: 'laws-pe-no-ai-summary',
		label: 'Lois PE avec résumé (IA)',
		description: `${lawsPENoSummary} lois avec texte mais sans analyse LLM`,
		severity: pctPENoSummary > 50 ? 'warning' : pctPENoSummary > 25 ? 'info' : 'ok',
		current: lawsPENoSummary,
		total: totalLawsPEWithText,
		pct: pctPENoSummary,
		command: 'make etl-europarl-analyze-laws',
		chamber: 'PE'
	});

	// Check 7: Lois AN sans tags (rempli par etl-an-analyze-laws, pas classify-scrutins)
	const lawsANNoTags = Number(row.laws_an_no_tags) || 0;
	const pctANNoTags = totalLawsAN > 0 ? (lawsANNoTags / totalLawsAN) * 100 : 0;
	checks.push({
		id: 'laws-an-no-tags',
		label: 'Lois AN avec tags (IA)',
		description: `${lawsANNoTags} lois sans tags sémantiques`,
		severity: pctANNoTags > 50 ? 'warning' : pctANNoTags > 25 ? 'info' : 'ok',
		current: lawsANNoTags,
		total: totalLawsAN,
		pct: pctANNoTags,
		command: 'make etl-an-analyze-laws',
		chamber: 'AN'
	});

	// === LIENS SCRUTINS-LOIS ===

	// Check 8: Scrutins AN liés à une loi
	const scrutinsANWithLaw = Number(row.scrutins_an_with_law) || 0;
	checks.push({
		id: 'scrutins-an-no-law',
		label: 'Scrutins AN liés à une loi',
		description:
			scrutinsANWithLaw === 0
				? 'Aucun scrutin lié à un dossier législatif'
				: `${scrutinsANWithLaw} scrutins liés sur ${totalScrutinsAN} (votes procéduraux exclus)`,
		severity: scrutinsANWithLaw === 0 ? 'critical' : 'ok',
		current: 0,
		total: scrutinsANWithLaw,
		pct: scrutinsANWithLaw === 0 ? 100 : 0,
		command: 'make etl-an-link-laws',
		chamber: 'AN'
	});

	// Check 26: Scrutins AN avec catégorie sémantique
	const scrutinsANWithCategory = Number(row.scrutins_an_with_category) || 0;
	const scrutinsANNoCategory = totalScrutinsAN - scrutinsANWithCategory;
	const pctANNoCategory = totalScrutinsAN > 0 ? (scrutinsANNoCategory / totalScrutinsAN) * 100 : 0;
	checks.push({
		id: 'scrutins-an-no-category',
		label: 'Scrutins AN avec catégorie',
		description: `${scrutinsANNoCategory} scrutins sans classification sémantique`,
		severity: pctANNoCategory > 50 ? 'warning' : pctANNoCategory > 10 ? 'info' : 'ok',
		current: scrutinsANNoCategory,
		total: totalScrutinsAN,
		pct: pctANNoCategory,
		command: 'make etl-an-classify-scrutins',
		chamber: 'AN'
	});

	// Check 21: Scrutins PE liés à une loi
	const totalScrutinsPE = Number(row.total_scrutins_pe) || 0;
	const scrutinsPEWithLaw = Number(row.scrutins_pe_with_law) || 0;
	checks.push({
		id: 'scrutins-pe-no-law',
		label: 'Scrutins PE liés à une loi',
		description:
			scrutinsPEWithLaw === 0
				? 'Aucun scrutin PE lié à un dossier législatif'
				: `${scrutinsPEWithLaw} scrutins liés sur ${totalScrutinsPE}`,
		severity: scrutinsPEWithLaw === 0 ? 'critical' : 'ok',
		current: 0,
		total: scrutinsPEWithLaw,
		pct: scrutinsPEWithLaw === 0 ? 100 : 0,
		command: 'make etl-europarl-laws',
		chamber: 'PE'
	});

	// === STATS ACTIVITÉ ===

	// Check 9: Députés avec stats (existence — API NosDéputés = législature courante uniquement)
	const actorsANWithStats = Number(row.actors_an_with_stats) || 0;
	checks.push({
		id: 'actors-an-no-stats',
		label: 'Députés avec stats activité',
		description:
			actorsANWithStats === 0
				? "Aucun député avec statistiques d'activité"
				: `${actorsANWithStats} députés avec stats (API NosDéputés : législature courante)`,
		severity: actorsANWithStats === 0 ? 'critical' : 'ok',
		current: 0,
		total: actorsANWithStats,
		pct: actorsANWithStats === 0 ? 100 : 0,
		command: 'make etl-an-nosdeputes-stats',
		chamber: 'AN'
	});

	// Check 10: Eurodéputés avec stats (existence — API HowTheyVote = mandat courant uniquement)
	const actorsPEWithStats = Number(row.actors_pe_with_stats) || 0;
	checks.push({
		id: 'actors-pe-no-stats',
		label: 'Eurodéputés avec stats activité',
		description:
			actorsPEWithStats === 0
				? "Aucun eurodéputé avec statistiques d'activité"
				: `${actorsPEWithStats} eurodéputés avec stats (API HowTheyVote : mandat courant)`,
		severity: actorsPEWithStats === 0 ? 'critical' : 'ok',
		current: 0,
		total: actorsPEWithStats,
		pct: actorsPEWithStats === 0 ? 100 : 0,
		command: 'make etl-europarl-activity-stats',
		chamber: 'PE'
	});

	// Check 11: Sénateurs avec stats (existence — API Sénat = sénateurs en exercice uniquement)
	const actorsSENATWithStats = Number(row.actors_senat_with_stats) || 0;
	checks.push({
		id: 'actors-senat-no-stats',
		label: 'Sénateurs avec stats activité',
		description:
			actorsSENATWithStats === 0
				? "Aucun sénateur avec statistiques d'activité"
				: `${actorsSENATWithStats} sénateurs avec stats (API Sénat : en exercice)`,
		severity: actorsSENATWithStats === 0 ? 'critical' : 'ok',
		current: 0,
		total: actorsSENATWithStats,
		pct: actorsSENATWithStats === 0 ? 100 : 0,
		command: 'make etl-senat-activity-stats',
		chamber: 'SENAT'
	});

	// Check 22: Eurodéputés historiques
	const actorsPENoHistorical = Number(row.actors_pe_no_historical_mandates) || 0;
	const pctPENoHistorical = totalActorsPE > 0 ? (actorsPENoHistorical / totalActorsPE) * 100 : 0;
	checks.push({
		id: 'actors-pe-historical',
		label: 'Eurodéputés historiques',
		description: `${actorsPENoHistorical} eurodéputés avec ≤1 mandat (pas d'historique)`,
		severity: pctPENoHistorical > 80 ? 'warning' : 'ok',
		current: actorsPENoHistorical,
		total: totalActorsPE,
		pct: pctPENoHistorical,
		command: 'make etl-europarl-historical',
		chamber: 'PE'
	});

	// Check 23: Sénateurs avec stats NosSénateurs (existence — API = en exercice uniquement)
	const actorsSenatWithNossenateurs = Number(row.actors_senat_with_nossenateurs) || 0;
	checks.push({
		id: 'actors-senat-no-nossenateurs',
		label: 'Sénateurs avec stats NosSénateurs',
		description:
			actorsSenatWithNossenateurs === 0
				? 'Aucun sénateur avec données NosSénateurs.fr'
				: `${actorsSenatWithNossenateurs} sénateurs avec données NosSénateurs.fr`,
		severity: actorsSenatWithNossenateurs === 0 ? 'critical' : 'ok',
		current: 0,
		total: actorsSenatWithNossenateurs,
		pct: actorsSenatWithNossenateurs === 0 ? 100 : 0,
		command: 'make etl-senat-nossenateurs-stats',
		chamber: 'SENAT'
	});

	// === ORGANES & ENRICHISSEMENT ===

	// Check 19: Groupes sans couleur
	const groupsTotal = Number(row.groups_total) || 0;
	const groupsNoColor = Number(row.groups_no_color) || 0;
	const pctNoColor = groupsTotal > 0 ? (groupsNoColor / groupsTotal) * 100 : 0;
	checks.push({
		id: 'organs-no-color',
		label: 'Groupes avec couleur',
		description: `${groupsNoColor} groupes parlementaires sans couleur assignée`,
		severity: pctNoColor > 30 ? 'critical' : pctNoColor > 10 ? 'warning' : 'ok',
		current: groupsNoColor,
		total: groupsTotal,
		pct: pctNoColor,
		command: 'make etl-colors',
		chamber: 'ALL'
	});

	// Check 20: Groupes PE/Sénat sans couleur externe
	const groupsPeSenatTotal = Number(row.groups_pe_senat_total) || 0;
	const groupsPeSenatNoColor = Number(row.groups_pe_senat_no_color) || 0;
	const pctPeSenatNoColor =
		groupsPeSenatTotal > 0 ? (groupsPeSenatNoColor / groupsPeSenatTotal) * 100 : 0;
	checks.push({
		id: 'organs-pe-no-color',
		label: 'Groupes PE/Sénat avec couleur ext.',
		description: `${groupsPeSenatNoColor} groupes PE/Sénat sans couleur`,
		severity: pctPeSenatNoColor > 30 ? 'warning' : pctPeSenatNoColor > 10 ? 'info' : 'ok',
		current: groupsPeSenatNoColor,
		total: groupsPeSenatTotal,
		pct: pctPeSenatNoColor,
		command: 'make etl-external-colors',
		chamber: 'ALL'
	});

	// Check 30: Groupes PE avec noms enrichis
	const groupsPETotal = Number(row.groups_pe_total) || 0;
	const groupsPENoShortname = Number(row.groups_pe_no_shortname) || 0;
	const pctPENoShortname = groupsPETotal > 0 ? (groupsPENoShortname / groupsPETotal) * 100 : 0;
	checks.push({
		id: 'groups-pe-enriched',
		label: 'Groupes PE avec noms enrichis',
		description: `${groupsPENoShortname} groupes PE sans nom court (short_name)`,
		severity: pctPENoShortname > 30 ? 'warning' : pctPENoShortname > 10 ? 'info' : 'ok',
		current: groupsPENoShortname,
		total: groupsPETotal,
		pct: pctPENoShortname,
		command: 'make etl-europarl-enrich-groups',
		chamber: 'PE'
	});

	// Check 24: Cosignataires dossiers AN
	const totalCosignatories = Number(row.total_cosignatories_an) || 0;
	checks.push({
		id: 'laws-an-no-dossier',
		label: 'Cosignataires dossiers AN',
		description:
			totalCosignatories === 0
				? 'Aucun cosignataire importé'
				: `${totalCosignatories} cosignataires en base`,
		severity: totalCosignatories === 0 ? 'critical' : 'ok',
		current: 0,
		total: totalCosignatories,
		pct: totalCosignatories === 0 ? 100 : 0,
		command: 'make etl-an-dossiers',
		chamber: 'AN'
	});

	// Check 25: Groupes sans position politique
	const groupsNoPosition = Number(row.groups_no_position) || 0;
	const pctNoPosition = groupsTotal > 0 ? (groupsNoPosition / groupsTotal) * 100 : 0;
	checks.push({
		id: 'organs-no-position',
		label: 'Groupes avec position politique',
		description: `${groupsNoPosition} groupes sans positionnement gauche-droite`,
		severity: pctNoPosition > 20 ? 'warning' : 'ok',
		current: groupsNoPosition,
		total: groupsTotal,
		pct: pctNoPosition,
		command: 'make etl-political-positions',
		chamber: 'ALL'
	});

	// Trier par sévérité puis par pct décroissant
	const severityOrder = { critical: 0, warning: 1, info: 2, ok: 3 };
	return checks.sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.pct - a.pct
	);
}
