/**
 * Helper serveur pour charger les données du quiz politique.
 *
 * Partagé entre les routes AN et PE pour éviter la duplication
 * de la logique de chargement des lois éligibles et des tags.
 */

import { db } from '$lib/server/db';
import { laws, lawSummaries, lawTags, tags, scrutins } from '$lib/server/db/schema';
import { eq, inArray, sql, desc } from 'drizzle-orm';

export interface QuizLawData {
	id: string;
	title: string;
	shortTitle: string | null;
	type: string;
	status: string | null;
	description: string | null;
	sourceUrl: string | null;
	summary: string;
	summaryModel: string | null;
	tags: { slug: string; name: string; color: string | null }[];
}

export interface QuizTagData {
	slug: string;
	name: string;
	color: string | null;
	lawCount: number;
}

/**
 * Charge toutes les lois éligibles au quiz et les tags disponibles
 * pour une législature donnée.
 *
 * La stratification (sélection, mélange, split quiz/réserve) est
 * déléguée au client via `quiz-selection.ts`.
 */
export async function loadQuizData(legislature: string): Promise<{
	allLaws: QuizLawData[];
	availableTags: QuizTagData[];
}> {
	const MIN_SCRUTINS = 1;

	// 1. Récupérer toutes les lois éligibles avec leur nombre de scrutins
	const eligibleLaws = await db
		.select({
			id: laws.id,
			title: laws.title,
			shortTitle: laws.shortTitle,
			type: laws.type,
			status: laws.status,
			description: laws.description,
			sourceUrl: laws.sourceUrl,
			summary: lawSummaries.summary,
			summaryModel: lawSummaries.model,
			scrutinCount: sql<number>`COUNT(DISTINCT ${scrutins.id})::int`
		})
		.from(laws)
		.innerJoin(lawSummaries, eq(laws.id, lawSummaries.lawId))
		.innerJoin(scrutins, eq(laws.id, scrutins.lawId))
		.where(eq(laws.legislature, legislature))
		.groupBy(laws.id, lawSummaries.summary, lawSummaries.model)
		.having(sql`COUNT(DISTINCT ${scrutins.id}) >= ${MIN_SCRUTINS}`)
		.orderBy(desc(sql`COUNT(DISTINCT ${scrutins.id})`));

	if (eligibleLaws.length === 0) {
		return { allLaws: [], availableTags: [] };
	}

	// 2. Récupérer les tags pour toutes les lois éligibles
	const lawIds = eligibleLaws.map((l) => l.id);
	const lawTagsData = await db
		.select({
			lawId: lawTags.lawId,
			slug: tags.slug,
			name: tags.name,
			color: tags.color
		})
		.from(lawTags)
		.innerJoin(tags, eq(lawTags.tagSlug, tags.slug))
		.where(inArray(lawTags.lawId, lawIds));

	// 3. Calculer les tags disponibles avec compteurs
	const tagCounts = new Map<string, QuizTagData>();
	for (const lt of lawTagsData) {
		const existing = tagCounts.get(lt.slug);
		if (existing) {
			existing.lawCount++;
		} else {
			tagCounts.set(lt.slug, { slug: lt.slug, name: lt.name, color: lt.color, lawCount: 1 });
		}
	}
	const availableTags = Array.from(tagCounts.values()).sort((a, b) => b.lawCount - a.lawCount);

	// 4. Indexer les tags par loi
	const tagsByLawId = new Map<string, { slug: string; name: string; color: string | null }[]>();
	for (const lt of lawTagsData) {
		if (!tagsByLawId.has(lt.lawId)) {
			tagsByLawId.set(lt.lawId, []);
		}
		tagsByLawId.get(lt.lawId)!.push({ slug: lt.slug, name: lt.name, color: lt.color });
	}

	const allLaws: QuizLawData[] = eligibleLaws.map((law) => ({
		id: law.id,
		title: law.title,
		shortTitle: law.shortTitle,
		type: law.type,
		status: law.status,
		description: law.description,
		sourceUrl: law.sourceUrl,
		summary: law.summary,
		summaryModel: law.summaryModel,
		tags: tagsByLawId.get(law.id) ?? []
	}));

	return { allLaws, availableTags };
}
