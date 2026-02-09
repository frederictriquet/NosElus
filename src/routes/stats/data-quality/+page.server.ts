/**
 * @fileoverview Loader serveur pour le dashboard qualité des données (/stats/data-quality).
 *
 * Architecture SvelteKit Streaming :
 * - Retourne des promises **non résolues** pour affichage progressif
 * - Chaque panel charge indépendamment avec skeleton/spinner
 * - TTFB quasi-instantané (~170ms), panels streamés en parallèle
 *
 * Optimisations SQL :
 * - Requêtes avec CTEs (Common Table Expressions) pour éviter N+1
 * - COUNT(*) FILTER (WHERE ...) pour agréger plusieurs métriques en 1 query
 * - LEFT JOIN pour inclure les mandatures sans scrutins
 *
 * @see AsyncCard composant utilisé pour le streaming côté client
 * @see {@link https://kit.svelte.dev/docs/load#streaming-with-promises} SvelteKit Streaming
 *
 * @module stats/data-quality/server
 */

import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

/**
 * Statistiques de qualité des données par mandature.
 * Exporté car utilisé dans page.helpers.ts pour le tri.
 */
export interface LegislatureStats {
	/** Identifiant de la mandature (e.g., "17", "PE-10", "SE-2023") */
	legislature: string;
	/** Chambre parlementaire */
	chamber: 'AN' | 'PE' | 'SENAT';
	/** Nombre total de lois dans cette mandature */
	totalLaws: number;
	/** Nombre de lois ayant au moins 1 scrutin */
	lawsWithVotes: number;
	/** Nombre de lois avec résumé IA */
	lawsWithSummaries: number;
	/** Nombre de lois avec au moins 1 tag */
	lawsWithTags: number;
	/** Nombre de lois avec description longue (>100 chars) */
	lawsWithDescription: number;
	/** Nombre total de scrutins dans cette mandature */
	totalScrutins: number;
}

/**
 * Statistiques globales affichées dans les KPI cards (section 1).
 */
interface GlobalStats {
	/** Nombre total de lois dans la base */
	totalLaws: number;
	/** Nombre total de scrutins */
	totalScrutins: number;
	/** Nombre total d'élus */
	totalActors: number;
	/** Nombre total de votes individuels enregistrés */
	totalVotes: number;
	/** Pourcentage de lois avec au moins 1 scrutin */
	coverageVotes: number;
	/** Pourcentage de lois analysées par IA */
	coverageAI: number;
}

/**
 * Statistiques par chambre (section 2).
 * Affiche la couverture des élus, groupes, mandats.
 */
interface ChamberStats {
	/** Chambre parlementaire */
	chamber: 'AN' | 'PE' | 'SENAT';
	/** Nombre total d'élus dans cette chambre */
	totalActors: number;
	/** Nombre de groupes politiques */
	totalGroups: number;
	/** Nombre de groupes avec couleur définie */
	groupsWithColor: number;
	/** Nombre total de mandats (historique) */
	totalMandates: number;
	/** Nombre d'élus avec statistiques d'activité */
	actorsWithStats: number;
}

/**
 * Loader SvelteKit pour /stats/data-quality.
 *
 * **Pattern SvelteKit Streaming** :
 * Retourne des promises NON RÉSOLUES pour permettre l'affichage progressif.
 * Le HTML initial se charge immédiatement (TTFB ~170ms), puis chaque panel
 * stream indépendamment via {#await}.
 *
 * **Avantages** :
 * - UX perçue améliorée (skeleton immédiat au lieu d'écran blanc)
 * - Parallélisation des 3 requêtes SQL
 * - Pas de blocage mutuel entre panels
 *
 * @returns Trois promises non résolues (globalStats, legislatureStats, chamberStats)
 * @see AsyncCard composant pour la gestion du streaming côté client
 */
export const load: PageServerLoad = async () => {
	/**
	 * Charge les stats globales (KPIs section 1).
	 *
	 * **Requête SQL** : 6 sous-requêtes agrégées en 1 SELECT.
	 * Alternative rejetée : 6 requêtes séparées (N+1 problème).
	 *
	 * **Streaming** : Promise retournée non résolue pour affichage progressif.
	 */
	const loadGlobalStats = async (): Promise<GlobalStats> => {
		const result = await db.execute<{
			total_laws: number;
			total_scrutins: number;
			total_actors: number;
			total_votes: number;
			laws_with_votes: number;
			laws_with_summaries: number;
		}>(sql`
			SELECT
				(SELECT COUNT(*) FROM laws) as total_laws,
				(SELECT COUNT(*) FROM scrutins) as total_scrutins,
				(SELECT COUNT(*) FROM actors) as total_actors,
				(SELECT COUNT(*) FROM votes) as total_votes,
				(SELECT COUNT(DISTINCT l.id) FROM laws l WHERE EXISTS (SELECT 1 FROM scrutins s WHERE s.law_id = l.id)) as laws_with_votes,
				(SELECT COUNT(DISTINCT l.id) FROM laws l WHERE EXISTS (SELECT 1 FROM law_summaries ls WHERE ls.law_id = l.id)) as laws_with_summaries
		`);

		const row = result[0];
		const totalLaws = Number(row.total_laws) || 0;
		const lawsWithVotes = Number(row.laws_with_votes) || 0;
		const lawsWithSummaries = Number(row.laws_with_summaries) || 0;

		return {
			totalLaws,
			totalScrutins: Number(row.total_scrutins) || 0,
			totalActors: Number(row.total_actors) || 0,
			totalVotes: Number(row.total_votes) || 0,
			coverageVotes: totalLaws > 0 ? (lawsWithVotes / totalLaws) * 100 : 0,
			coverageAI: totalLaws > 0 ? (lawsWithSummaries / totalLaws) * 100 : 0
		};
	};

	/**
	 * Charge les stats détaillées par mandature (section 3, tableau interactif).
	 *
	 * **Pattern CTE (Common Table Expression)** :
	 * - `law_stats` : agrège les stats par legislature (COUNT avec FILTER)
	 * - `scrutin_stats` : compte les scrutins par legislature
	 * - JOIN des 2 CTEs pour éviter le N+1 (1 requête au lieu de N)
	 *
	 * **COUNT(*) FILTER (WHERE ...)** :
	 * Permet d'agréger plusieurs métriques en 1 requête au lieu de 5 COUNT séparés.
	 * Équivalent à : SUM(CASE WHEN ... THEN 1 ELSE 0 END).
	 *
	 * **Performance** : ~20 législatures × 5 métriques = 1 requête au lieu de 100+.
	 *
	 * @returns Array de stats par mandature (AN, PE, SENAT mélangés)
	 */
	const loadLegislatureStats = async (): Promise<LegislatureStats[]> => {
		const result = await db.execute<{
			legislature: string;
			total_laws: number;
			laws_with_votes: number;
			laws_with_summaries: number;
			laws_with_tags: number;
			laws_with_description: number;
			total_scrutins: number;
		}>(sql`
			WITH law_stats AS (
				SELECT
					l.legislature,
					COUNT(*) as total_laws,
					COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM scrutins s WHERE s.law_id = l.id)) as laws_with_votes,
					COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM law_summaries ls WHERE ls.law_id = l.id)) as laws_with_summaries,
					COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM law_tags lt WHERE lt.law_id = l.id)) as laws_with_tags,
					COUNT(*) FILTER (WHERE l.description IS NOT NULL AND length(l.description) > 100) as laws_with_description
				FROM laws l
				GROUP BY l.legislature
			),
			scrutin_stats AS (
				SELECT
					legislature,
					COUNT(*) as total_scrutins
				FROM scrutins
				GROUP BY legislature
			)
			SELECT
				ls.legislature,
				ls.total_laws,
				ls.laws_with_votes,
				ls.laws_with_summaries,
				ls.laws_with_tags,
				ls.laws_with_description,
				COALESCE(ss.total_scrutins, 0) as total_scrutins
			FROM law_stats ls
			LEFT JOIN scrutin_stats ss ON ls.legislature = ss.legislature
			ORDER BY ls.legislature
		`);

		return result.map((row) => {
			const legislature = row.legislature;
			// Détection de la chambre à partir du préfixe legislature
			const chamber: 'AN' | 'PE' | 'SENAT' = legislature.startsWith('PE-')
				? 'PE'
				: legislature.startsWith('SE-')
					? 'SENAT'
					: 'AN';

			return {
				legislature,
				chamber,
				totalLaws: Number(row.total_laws) || 0,
				lawsWithVotes: Number(row.laws_with_votes) || 0,
				lawsWithSummaries: Number(row.laws_with_summaries) || 0,
				lawsWithTags: Number(row.laws_with_tags) || 0,
				lawsWithDescription: Number(row.laws_with_description) || 0,
				totalScrutins: Number(row.total_scrutins) || 0
			};
		});
	};

	/**
	 * Charge les stats par chambre (section 2).
	 *
	 * **Pattern : 4 CTEs indépendantes** :
	 * - `actor_counts` : total élus par chambre
	 * - `group_counts` : groupes politiques (GP) et couleurs
	 * - `mandate_counts` : mandats historiques
	 * - `activity_counts` : élus avec statistiques d'activité
	 *
	 * **Pourquoi 4 CTEs** : Évite le produit cartésien.
	 * Alternative rejetée : 1 CTE avec CROSS JOIN aurait multiplié les lignes.
	 *
	 * **LEFT JOIN** : Inclut les chambres même sans mandats ou activité.
	 *
	 * @returns Array de stats (1 élément par chambre : AN, PE, SENAT)
	 */
	const loadChamberStats = async (): Promise<ChamberStats[]> => {
		const result = await db.execute<{
			chamber: 'AN' | 'PE' | 'SENAT';
			total_actors: number;
			total_groups: number;
			groups_with_color: number;
			total_mandates: number;
			actors_with_stats: number;
		}>(sql`
			WITH actor_counts AS (
				SELECT chamber, COUNT(*) as total_actors
				FROM actors
				GROUP BY chamber
			),
			group_counts AS (
				SELECT chamber,
					COUNT(*) FILTER (WHERE type = 'GP') as total_groups,
					COUNT(*) FILTER (WHERE type = 'GP' AND color IS NOT NULL) as groups_with_color
				FROM organs
				GROUP BY chamber
			),
			mandate_counts AS (
				SELECT o.chamber, COUNT(*) as total_mandates
				FROM mandates m JOIN organs o ON m.organ_id = o.id
				GROUP BY o.chamber
			),
			activity_counts AS (
				SELECT a.chamber, COUNT(DISTINCT as2.actor_id) as actors_with_stats
				FROM actor_stats as2 JOIN actors a ON a.id = as2.actor_id
				GROUP BY a.chamber
			)
			SELECT ac.chamber, ac.total_actors,
				COALESCE(gc.total_groups, 0) as total_groups,
				COALESCE(gc.groups_with_color, 0) as groups_with_color,
				COALESCE(mc.total_mandates, 0) as total_mandates,
				COALESCE(act.actors_with_stats, 0) as actors_with_stats
			FROM actor_counts ac
			LEFT JOIN group_counts gc ON ac.chamber = gc.chamber
			LEFT JOIN mandate_counts mc ON ac.chamber = mc.chamber
			LEFT JOIN activity_counts act ON ac.chamber = act.chamber
			ORDER BY ac.chamber
		`);

		return result.map((row) => ({
			chamber: row.chamber,
			totalActors: Number(row.total_actors) || 0,
			totalGroups: Number(row.total_groups) || 0,
			groupsWithColor: Number(row.groups_with_color) || 0,
			totalMandates: Number(row.total_mandates) || 0,
			actorsWithStats: Number(row.actors_with_stats) || 0
		}));
	};

	/**
	 * Pattern SvelteKit Streaming : retourner des promises NON RÉSOLUES.
	 *
	 * IMPORTANT : Ne pas `await` ici !
	 * - ✅ Correct : `globalStats: loadGlobalStats()` (promise non résolue)
	 * - ❌ Incorrect : `globalStats: await loadGlobalStats()` (bloque le loader)
	 *
	 * Le composant AsyncCard côté client gère le {#await} et affiche :
	 * - Skeleton pendant le chargement
	 * - Contenu une fois la promise résolue
	 * - Message d'erreur si la promise rejette
	 *
	 * @see AsyncCard.svelte pour le rendu côté client
	 */
	return {
		globalStats: loadGlobalStats(),
		legislatureStats: loadLegislatureStats(),
		chamberStats: loadChamberStats()
	};
};
