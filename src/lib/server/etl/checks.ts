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

// === HELPERS DE CONSTRUCTION DE CHECKS ===

/**
 * Helper pour les checks de fraîcheur des données.
 * Seuils : >30j critical, >15j warning, sinon ok.
 * current=Math.min(days,30), total=30.
 */
function freshnessCheck(
	id: string,
	label: string,
	days: number,
	command: string,
	chamber: ETLChamber
): ETLCheckResult {
	return {
		id,
		label,
		description:
			days > 30
				? `Dernière sync il y a ${days} jours (>30j)`
				: `Dernière sync il y a ${days} jours`,
		severity: days > 30 ? 'critical' : days > 15 ? 'warning' : 'ok',
		current: Math.min(days, 30),
		total: 30,
		pct: Math.min(100, (days / 30) * 100),
		command,
		chamber
	};
}

/**
 * Helper pour les checks binaires de présence (count > 0).
 * Seuils : 0 → critical, < warningThreshold → warning, sinon ok.
 * current=0, total=count, pct = count===0 ? 100 : 0.
 */
function existenceCheck(
	id: string,
	label: string,
	description: string,
	count: number,
	warningThreshold: number,
	command: string,
	chamber: ETLChamber
): ETLCheckResult {
	return {
		id,
		label,
		description,
		severity: count === 0 ? 'critical' : count < warningThreshold ? 'warning' : 'ok',
		current: 0,
		total: count,
		pct: count === 0 ? 100 : 0,
		command,
		chamber
	};
}

/**
 * Helper pour les checks de ratio (missing/total).
 * thresholds définit les seuils en pourcentage pour chaque sévérité.
 * pct = total > 0 ? (missing/total)*100 : 0.
 * Logique : pct > critical → critical, > warning → warning, > info → info, sinon ok.
 * Seuils non spécifiés valent Infinity (jamais déclenchés).
 */
function completenessCheck(
	id: string,
	label: string,
	description: string,
	missing: number,
	total: number,
	thresholds: { critical?: number; warning?: number; info?: number },
	command: string,
	chamber: ETLChamber
): ETLCheckResult {
	const pct = total > 0 ? (missing / total) * 100 : 0;
	const severity: ETLCheckSeverity =
		pct > (thresholds.critical ?? Infinity)
			? 'critical'
			: pct > (thresholds.warning ?? Infinity)
				? 'warning'
				: pct > (thresholds.info ?? Infinity)
					? 'info'
					: 'ok';
	return { id, label, description, severity, current: missing, total, pct, command, chamber };
}

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
 * **Pattern CTE SQL** : Une seule requête agrège 36+ métriques
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
		total_laws_an_enrichable: number;
		total_laws_pe: number;
		total_laws_senat: number;
		laws_an_no_fulltext: number;
		laws_pe_no_fulltext: number;
		laws_an_no_summary: number;
		laws_pe_no_summary: number;
		laws_an_no_tags: number;
		total_cosignatories_an: number;
		laws_an_skiplist_low_score: number;
		laws_an_promulgated_no_text: number;
		laws_an_not_promulgated_no_text: number;
		// Scrutins
		total_scrutins_an: number;
		scrutins_an_with_law: number;
		scrutins_an_with_category: number;
		scrutins_an_vote_final_total: number;
		scrutins_an_vote_final_no_title_simple: number;
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
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND id NOT LIKE 'SEN-%'
					AND (status IN ('promulgué', 'adopté') OR status IS NULL)) as total_laws_an_enrichable,
				COUNT(*) FILTER (WHERE legislature LIKE 'PE-%') as total_laws_pe,
				COUNT(*) FILTER (WHERE id LIKE 'SEN-%') as total_laws_senat,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND id NOT LIKE 'SEN-%'
					AND (status IN ('promulgué', 'adopté') OR status IS NULL)
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
				(SELECT COUNT(*) FROM law_cosignatories lc
					JOIN laws l3 ON l3.id = lc.law_id
					WHERE (l3.legislature LIKE 'AN-%' OR l3.legislature ~ '^[0-9]+$')
					AND l3.id NOT LIKE 'SEN-%') as total_cosignatories_an,
				(SELECT COUNT(*) FROM law_text_skip_list s
					JOIN laws l2 ON l2.id = s.law_id
					WHERE s.reason = 'low_score'
					AND (l2.legislature LIKE 'AN-%' OR l2.legislature ~ '^[0-9]+$')
					AND l2.id NOT LIKE 'SEN-%'
					AND l2.description IS NULL) as laws_an_skiplist_low_score,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND id NOT LIKE 'SEN-%'
					AND status = 'promulgué'
					AND (description IS NULL OR length(description) <= ${MIN_DESCRIPTION_LENGTH})) as laws_an_promulgated_no_text,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND id NOT LIKE 'SEN-%'
					AND (status IS NULL OR status != 'promulgué')
					AND (description IS NULL OR length(description) <= ${MIN_DESCRIPTION_LENGTH})) as laws_an_not_promulgated_no_text
			FROM laws l
		),
		scrutin_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$') as total_scrutins_an,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND law_id IS NOT NULL) as scrutins_an_with_law,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND category IS NOT NULL) as scrutins_an_with_category,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND category = 'vote-final') as scrutins_an_vote_final_total,
				COUNT(*) FILTER (WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
					AND category = 'vote-final'
					AND title_simple IS NULL) as scrutins_an_vote_final_no_title_simple,
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
				-- uid IS NOT NULL filtre les eurodéputés identifiés dans le système HowTheyVote
				-- (seuls ceux avec un uid ont un profil exploitable pour l'historique des mandats)
				COUNT(*) FILTER (WHERE chamber = 'PE'
					AND uid IS NOT NULL
					AND (SELECT COUNT(*) FROM mandates m WHERE m.actor_id = a.id AND m.organ_id LIKE 'GPEU-%') <= 1
				) as actors_pe_no_historical_mandates,
				COUNT(*) FILTER (WHERE chamber = 'SENAT'
					AND EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id AND ast.source = 'nossenateurs')
				) as actors_senat_with_nossenateurs
			FROM actors a
		),
		-- La table amendments ne contient que des données AN (unique chambre avec amendements importés)
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

	const daysSinceAN = row.last_sync_an_days ?? 999;
	checks.push(
		freshnessCheck(
			'stale-an-data',
			'Fraîcheur données AN',
			daysSinceAN,
			'make etl-an-incremental',
			'AN'
		)
	);

	const daysSincePE = row.last_sync_pe_days ?? 999;
	checks.push(
		freshnessCheck(
			'stale-pe-data',
			'Fraîcheur données PE',
			daysSincePE,
			'make etl-europarl-votes',
			'PE'
		)
	);

	const daysSinceSenat = row.last_sync_senat_days ?? 999;
	checks.push(
		freshnessCheck(
			'stale-senat-data',
			'Fraîcheur données Sénat',
			daysSinceSenat,
			'make etl-senat-senators',
			'SENAT'
		)
	);

	// === COMPTEURS D'IMPORT DE BASE ===

	const totalActorsAN = Number(row.total_actors_an) || 0;
	checks.push(
		existenceCheck(
			'actors-an-count',
			'Députés en base',
			totalActorsAN === 0 ? 'Aucun député importé' : `${totalActorsAN} députés en base`,
			totalActorsAN,
			500,
			'make etl-an-actors',
			'AN'
		)
	);

	const totalActorsSENAT = Number(row.total_actors_senat) || 0;
	checks.push(
		existenceCheck(
			'actors-senat-count',
			'Sénateurs en base',
			totalActorsSENAT === 0 ? 'Aucun sénateur importé' : `${totalActorsSENAT} sénateurs en base`,
			totalActorsSENAT,
			300,
			'make etl-senat-senators',
			'SENAT'
		)
	);

	const totalActorsPE = Number(row.total_actors_pe) || 0;
	checks.push(
		existenceCheck(
			'actors-pe-count',
			'Eurodéputés en base',
			totalActorsPE === 0 ? 'Aucun eurodéputé importé' : `${totalActorsPE} eurodéputés en base`,
			totalActorsPE,
			50,
			'make etl-europarl-meps',
			'PE'
		)
	);

	const totalLawsAN = Number(row.total_laws_an) || 0;
	checks.push(
		existenceCheck(
			'laws-an-count',
			'Lois AN en base',
			totalLawsAN === 0 ? 'Aucune loi AN importée' : `${totalLawsAN} lois AN en base`,
			totalLawsAN,
			500,
			'make etl-an-laws',
			'AN'
		)
	);

	const totalScrutinsAN = Number(row.total_scrutins_an) || 0;
	checks.push(
		existenceCheck(
			'scrutins-an-count',
			'Scrutins AN en base',
			totalScrutinsAN === 0 ? 'Aucun scrutin AN importé' : `${totalScrutinsAN} scrutins AN en base`,
			totalScrutinsAN,
			100,
			'make etl-an-scrutins',
			'AN'
		)
	);

	const totalLawsSenat = Number(row.total_laws_senat) || 0;
	checks.push(
		existenceCheck(
			'laws-senat-count',
			'Lois Sénat en base',
			totalLawsSenat === 0 ? 'Aucune loi Sénat importée' : `${totalLawsSenat} lois Sénat en base`,
			totalLawsSenat,
			1000,
			'make etl-senat-laws',
			'SENAT'
		)
	);

	const totalScrutinsPE = Number(row.total_scrutins_pe) || 0;
	checks.push(
		existenceCheck(
			'scrutins-pe-count',
			'Scrutins PE en base',
			totalScrutinsPE === 0 ? 'Aucun scrutin PE importé' : `${totalScrutinsPE} scrutins PE en base`,
			totalScrutinsPE,
			100,
			'make etl-europarl-votes',
			'PE'
		)
	);

	const totalAmendmentsAN = Number(row.total_amendments_an) || 0;
	checks.push(
		existenceCheck(
			'amendments-an-count',
			'Amendements AN en base',
			totalAmendmentsAN === 0
				? 'Aucun amendement importé'
				: `${totalAmendmentsAN} amendements en base`,
			totalAmendmentsAN,
			10,
			'make etl-an-amendements',
			'AN'
		)
	);

	const totalMandatesSenat = Number(row.total_mandates_senat) || 0;
	checks.push(
		existenceCheck(
			'mandates-senat-count',
			'Mandats historiques Sénat',
			totalMandatesSenat === 0
				? 'Aucun mandat sénatorial importé'
				: `${totalMandatesSenat} mandats sénatoriaux en base`,
			totalMandatesSenat,
			100,
			'make etl-senat-mandates-history',
			'SENAT'
		)
	);

	// === TEXTES & ANALYSES ===

	// Ne compte que les lois enrichissables (promulguées, adoptées, NULL) — pas les "en cours"
	const totalLawsANEnrichable = Number(row.total_laws_an_enrichable) || 0;
	const lawsANNoFulltext = Number(row.laws_an_no_fulltext) || 0;
	checks.push(
		completenessCheck(
			'laws-an-no-fulltext',
			'Lois AN avec texte complet',
			`${lawsANNoFulltext} lois (promulguées/adoptées) sans texte Légifrance`,
			lawsANNoFulltext,
			totalLawsANEnrichable,
			{ critical: 50, warning: 25, info: 10 },
			'make etl-an-law-texts',
			'AN'
		)
	);

	// Lois promulguées sans texte : vrai problème à corriger (devrait être ~0)
	const lawsANPromulgatedNoText = Number(row.laws_an_promulgated_no_text) || 0;
	checks.push(
		completenessCheck(
			'laws-an-promulgated-no-text',
			'Lois AN promulguées avec texte',
			lawsANPromulgatedNoText === 0
				? 'Toutes les lois promulguées ont leur texte Légifrance'
				: `${lawsANPromulgatedNoText} lois promulguées sans texte (matching Jaccard à vérifier)`,
			lawsANPromulgatedNoText,
			totalLawsAN - (Number(row.laws_an_not_promulgated_no_text) || 0),
			{ critical: 5, warning: 1 },
			'make etl-an-law-texts ARGS="--force --threshold 0.3"',
			'AN'
		)
	);

	// Lois non promulguées sans texte : normal (le texte n'existe pas dans Légifrance)
	// current=0 car rien à corriger ; total=count pour affichage informatif
	const lawsANNotPromulgatedNoText = Number(row.laws_an_not_promulgated_no_text) || 0;
	checks.push({
		id: 'laws-an-not-promulgated',
		label: 'Lois AN non promulguées (sans texte attendu)',
		description: `${lawsANNotPromulgatedNoText} propositions non promulguées — texte inexistant dans Légifrance (normal)`,
		severity: 'ok' as ETLCheckSeverity,
		current: 0,
		total: lawsANNotPromulgatedNoText,
		pct: 0,
		command: 'make etl-an-dossiers',
		chamber: 'AN' as ETLChamber
	});

	const lawsPENoFulltext = Number(row.laws_pe_no_fulltext) || 0;
	const totalLawsPE = Number(row.total_laws_pe) || 0;
	checks.push(
		completenessCheck(
			'laws-pe-no-fulltext',
			'Lois PE avec texte complet',
			`${lawsPENoFulltext} lois sans description >100 caractères`,
			lawsPENoFulltext,
			totalLawsPE,
			{ critical: 50, warning: 25, info: 10 },
			'make etl-europarl-law-texts',
			'PE'
		)
	);

	const scrutinsANVoteFinalTotal = Number(row.scrutins_an_vote_final_total) || 0;
	const scrutinsANVoteFinalNoTitleSimple = Number(row.scrutins_an_vote_final_no_title_simple) || 0;
	checks.push(
		completenessCheck(
			'scrutins-an-no-title-simple',
			'Scrutins AN (vote-final) avec titre simplifié',
			`${scrutinsANVoteFinalNoTitleSimple} scrutins vote-final sans titre simplifié (cartes partage OG)`,
			scrutinsANVoteFinalNoTitleSimple,
			scrutinsANVoteFinalTotal,
			{ warning: 50, info: 10 },
			'make etl-simplify-scrutins ARGS="--category vote-final"',
			'AN'
		)
	);

	const lawsANNoSummary = Number(row.laws_an_no_summary) || 0;
	const totalLawsANWithText = totalLawsANEnrichable - lawsANNoFulltext;
	checks.push(
		completenessCheck(
			'laws-an-no-ai-summary',
			'Lois AN avec résumé (IA)',
			`${lawsANNoSummary} lois avec texte mais sans analyse LLM`,
			lawsANNoSummary,
			totalLawsANWithText,
			{ warning: 50, info: 25 },
			'make etl-an-analyze-laws',
			'AN'
		)
	);

	const lawsPENoSummary = Number(row.laws_pe_no_summary) || 0;
	const totalLawsPEWithText = totalLawsPE - lawsPENoFulltext;
	checks.push(
		completenessCheck(
			'laws-pe-no-ai-summary',
			'Lois PE avec résumé (IA)',
			`${lawsPENoSummary} lois avec texte mais sans analyse LLM`,
			lawsPENoSummary,
			totalLawsPEWithText,
			{ warning: 50, info: 25 },
			'make etl-europarl-analyze-laws',
			'PE'
		)
	);

	const lawsANNoTags = Number(row.laws_an_no_tags) || 0;
	checks.push(
		completenessCheck(
			'laws-an-no-tags',
			'Lois AN avec tags (IA)',
			`${lawsANNoTags} lois sans tags sémantiques`,
			lawsANNoTags,
			totalLawsAN,
			{ warning: 50, info: 25 },
			'make etl-an-analyze-laws',
			'AN'
		)
	);

	// === LIENS SCRUTINS-LOIS ===

	const scrutinsANWithLaw = Number(row.scrutins_an_with_law) || 0;
	checks.push(
		existenceCheck(
			'scrutins-an-linked',
			'Scrutins AN liés à une loi',
			scrutinsANWithLaw === 0
				? 'Aucun scrutin lié à un dossier législatif'
				: `${scrutinsANWithLaw} scrutins liés sur ${totalScrutinsAN} (votes procéduraux exclus)`,
			scrutinsANWithLaw,
			0,
			'make etl-an-link-laws',
			'AN'
		)
	);

	const scrutinsANWithCategory = Number(row.scrutins_an_with_category) || 0;
	const scrutinsANNoCategory = totalScrutinsAN - scrutinsANWithCategory;
	checks.push(
		completenessCheck(
			'scrutins-an-no-category',
			'Scrutins AN avec catégorie',
			`${scrutinsANNoCategory} scrutins sans classification sémantique`,
			scrutinsANNoCategory,
			totalScrutinsAN,
			{ warning: 50, info: 10 },
			'make etl-an-classify-scrutins',
			'AN'
		)
	);

	const scrutinsPEWithLaw = Number(row.scrutins_pe_with_law) || 0;
	checks.push(
		existenceCheck(
			'scrutins-pe-linked',
			'Scrutins PE liés à une loi',
			scrutinsPEWithLaw === 0
				? 'Aucun scrutin PE lié à un dossier législatif'
				: `${scrutinsPEWithLaw} scrutins liés sur ${totalScrutinsPE}`,
			scrutinsPEWithLaw,
			0,
			'make etl-europarl-laws',
			'PE'
		)
	);

	// === STATS ACTIVITÉ ===

	const actorsANWithStats = Number(row.actors_an_with_stats) || 0;
	checks.push(
		existenceCheck(
			'actors-an-with-stats',
			'Députés avec stats activité',
			actorsANWithStats === 0
				? "Aucun député avec statistiques d'activité"
				: `${actorsANWithStats} députés avec stats (API NosDéputés : législature courante)`,
			actorsANWithStats,
			0,
			'make etl-an-nosdeputes-stats',
			'AN'
		)
	);

	const actorsPEWithStats = Number(row.actors_pe_with_stats) || 0;
	checks.push(
		existenceCheck(
			'actors-pe-with-stats',
			'Eurodéputés avec stats activité',
			actorsPEWithStats === 0
				? "Aucun eurodéputé avec statistiques d'activité"
				: `${actorsPEWithStats} eurodéputés avec stats (API HowTheyVote : mandat courant)`,
			actorsPEWithStats,
			0,
			'make etl-europarl-activity-stats',
			'PE'
		)
	);

	const actorsSENATWithStats = Number(row.actors_senat_with_stats) || 0;
	checks.push(
		existenceCheck(
			'actors-senat-with-stats',
			'Sénateurs avec stats activité',
			actorsSENATWithStats === 0
				? "Aucun sénateur avec statistiques d'activité"
				: `${actorsSENATWithStats} sénateurs avec stats (API Sénat : en exercice)`,
			actorsSENATWithStats,
			0,
			'make etl-senat-activity-stats',
			'SENAT'
		)
	);

	const actorsPENoHistorical = Number(row.actors_pe_no_historical_mandates) || 0;
	checks.push(
		completenessCheck(
			'actors-pe-historical',
			'Eurodéputés historiques',
			`${actorsPENoHistorical} eurodéputés avec ≤1 mandat (pas d'historique)`,
			actorsPENoHistorical,
			totalActorsPE,
			{ warning: 80 },
			'make etl-europarl-historical',
			'PE'
		)
	);

	const actorsSenatWithNossenateurs = Number(row.actors_senat_with_nossenateurs) || 0;
	checks.push(
		existenceCheck(
			'actors-senat-with-nossenateurs',
			'Sénateurs avec stats NosSénateurs',
			actorsSenatWithNossenateurs === 0
				? 'Aucun sénateur avec données NosSénateurs.fr'
				: `${actorsSenatWithNossenateurs} sénateurs avec données NosSénateurs.fr`,
			actorsSenatWithNossenateurs,
			0,
			'make etl-senat-nossenateurs-stats',
			'SENAT'
		)
	);

	// === ORGANES & ENRICHISSEMENT ===

	const groupsTotal = Number(row.groups_total) || 0;
	const groupsNoColor = Number(row.groups_no_color) || 0;
	// Sévérité critical intentionnelle : les couleurs AN sont prioritaires car elles
	// alimentent les graphiques de l'hémicycle et les pages députés (impact UX direct).
	checks.push(
		completenessCheck(
			'organs-no-color',
			'Groupes avec couleur',
			`${groupsNoColor} groupes parlementaires sans couleur assignée`,
			groupsNoColor,
			groupsTotal,
			{ critical: 30, warning: 10 },
			'make etl-colors',
			'ALL'
		)
	);

	const groupsPeSenatTotal = Number(row.groups_pe_senat_total) || 0;
	const groupsPeSenatNoColor = Number(row.groups_pe_senat_no_color) || 0;
	checks.push(
		completenessCheck(
			'organs-pe-senat-no-color',
			'Groupes PE/Sénat avec couleur ext.',
			`${groupsPeSenatNoColor} groupes PE/Sénat sans couleur`,
			groupsPeSenatNoColor,
			groupsPeSenatTotal,
			{ warning: 30, info: 10 },
			'make etl-external-colors',
			'ALL'
		)
	);

	const groupsPETotal = Number(row.groups_pe_total) || 0;
	const groupsPENoShortname = Number(row.groups_pe_no_shortname) || 0;
	checks.push(
		completenessCheck(
			'groups-pe-enriched',
			'Groupes PE avec noms enrichis',
			`${groupsPENoShortname} groupes PE sans nom court (short_name)`,
			groupsPENoShortname,
			groupsPETotal,
			{ warning: 30, info: 10 },
			'make etl-europarl-enrich-groups',
			'PE'
		)
	);

	const totalCosignatories = Number(row.total_cosignatories_an) || 0;
	checks.push(
		existenceCheck(
			'cosignatories-an-count',
			'Cosignataires dossiers AN',
			totalCosignatories === 0
				? 'Aucun cosignataire importé'
				: `${totalCosignatories} cosignataires en base`,
			totalCosignatories,
			0,
			'make etl-an-dossiers',
			'AN'
		)
	);

	const groupsNoPosition = Number(row.groups_no_position) || 0;
	checks.push(
		completenessCheck(
			'organs-no-position',
			'Groupes avec position politique',
			`${groupsNoPosition} groupes sans positionnement gauche-droite`,
			groupsNoPosition,
			groupsTotal,
			{ warning: 20 },
			'make etl-political-positions',
			'ALL'
		)
	);

	// Trier par sévérité puis par pct décroissant
	const severityOrder = { critical: 0, warning: 1, info: 2, ok: 3 };
	return checks.sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.pct - a.pct
	);
}
