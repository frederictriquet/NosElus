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
	scrutinsLinked: number;
	scrutinsCategorized: number;
}

interface GlobalStats {
	totalLaws: number;
	totalScrutins: number;
	totalActors: number;
	totalVotes: number;
	coverageVotes: number;
	coverageAI: number;
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
		const totalLaws = row.total_laws || 0;

		return {
			totalLaws,
			totalScrutins: row.total_scrutins || 0,
			totalActors: row.total_actors || 0,
			totalVotes: row.total_votes || 0,
			coverageVotes: totalLaws > 0 ? (row.laws_with_votes / totalLaws) * 100 : 0,
			coverageAI: totalLaws > 0 ? (row.laws_with_summaries / totalLaws) * 100 : 0
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
			scrutins_linked: number;
			scrutins_categorized: number;
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
					COUNT(*) as total_scrutins,
					COUNT(law_id) as scrutins_linked,
					COUNT(*) FILTER (WHERE category IS NOT NULL) as scrutins_categorized
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
				COALESCE(ss.total_scrutins, 0) as total_scrutins,
				COALESCE(ss.scrutins_linked, 0) as scrutins_linked,
				COALESCE(ss.scrutins_categorized, 0) as scrutins_categorized
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
				totalLaws: row.total_laws || 0,
				lawsWithVotes: row.laws_with_votes || 0,
				lawsWithSummaries: row.laws_with_summaries || 0,
				lawsWithTags: row.laws_with_tags || 0,
				lawsWithDescription: row.laws_with_description || 0,
				totalScrutins: row.total_scrutins || 0,
				scrutinsLinked: row.scrutins_linked || 0,
				scrutinsCategorized: row.scrutins_categorized || 0
			};
		});
	};

	// Pattern SvelteKit streaming : retourner des promises non résolues
	return {
		globalStats: loadGlobalStats(),
		legislatureStats: loadLegislatureStats()
	};
};
