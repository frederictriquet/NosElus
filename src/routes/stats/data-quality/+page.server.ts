import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

interface LegislatureStats {
	legislature: string;
	chamber: 'AN' | 'PE' | 'SENAT';
	totalLaws: number;
	lawsWithVotes: number;
	lawsWithSummaries: number;
	lawsWithTags: number;
	lawsWithDescription: number;
	totalScrutins: number;
}

interface GlobalStats {
	totalLaws: number;
	totalScrutins: number;
	totalActors: number;
	totalVotes: number;
	coverageVotes: number;
	coverageAI: number;
}

interface ChamberStats {
	chamber: 'AN' | 'PE' | 'SENAT';
	totalActors: number;
	totalGroups: number;
	groupsWithColor: number;
	totalMandates: number;
	actorsWithStats: number;
}

export const load: PageServerLoad = async () => {
	/**
	 * Charge les stats globales (KPIs en haut de page)
	 * Promise streamée pour affichage immédiat du skeleton
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
	 * Charge les stats détaillées par législature
	 * Requête SQL avec CTE pour performance (1 requête, pas de N+1)
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
	 * Charge les stats par chambre (élus, groupes, mandats, activité)
	 * 4 CTEs indépendantes jointes pour éviter le produit cartésien
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

	// Pattern SvelteKit streaming : retourner des promises non résolues
	return {
		globalStats: loadGlobalStats(),
		legislatureStats: loadLegislatureStats(),
		chamberStats: loadChamberStats()
	};
};
