import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { laws, lawSummaries, lawTags, tags, scrutins } from '$lib/server/db/schema';
import { eq, inArray, sql, and, desc } from 'drizzle-orm';

/**
 * Sélectionne les lois pour le quiz politique.
 *
 * Implémente l'algorithme de sélection mixte (ADR-006) :
 * - Filtre : lois avec résumé IA + au moins 1 scrutin
 * - Stratification : diversité thématique via tags
 * - Randomisation : sélection aléatoire dans chaque groupe de tags
 *
 * @returns 15 lois pour le quiz + lois de réserve pour l'abstention
 */
export const load: PageServerLoad = async () => {
	const QUIZ_SIZE = 15;
	const MIN_SCRUTINS = 1;
	const LEGISLATURE = '17';

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
		.where(eq(laws.legislature, LEGISLATURE))
		.groupBy(laws.id, lawSummaries.summary, lawSummaries.model)
		.having(sql`COUNT(DISTINCT ${scrutins.id}) >= ${MIN_SCRUTINS}`)
		.orderBy(desc(sql`COUNT(DISTINCT ${scrutins.id})`));

	if (eligibleLaws.length === 0) {
		return { laws: [], reserveLaws: [] };
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

	// 3. Grouper les lois par tag principal (premier tag)
	const lawsByTag = new Map<string, typeof eligibleLaws>();

	for (const law of eligibleLaws) {
		const lawTagsList = lawTagsData.filter((lt) => lt.lawId === law.id);
		if (lawTagsList.length > 0) {
			const primaryTag = lawTagsList[0].slug;
			if (!lawsByTag.has(primaryTag)) {
				lawsByTag.set(primaryTag, []);
			}
			lawsByTag.get(primaryTag)!.push(law);
		}
	}

	// 4. Stratifier : prendre des lois de chaque tag avec priorité équilibrée
	const selectedLaws: typeof eligibleLaws = [];
	const tagArray = Array.from(lawsByTag.entries());

	// Première passe : prendre équitablement pour le quiz
	const lawsPerTag = Math.ceil(QUIZ_SIZE / tagArray.length);

	for (const [, tagLaws] of tagArray) {
		const shuffled = tagLaws.sort(() => Math.random() - 0.5);
		selectedLaws.push(...shuffled.slice(0, lawsPerTag));
	}

	// Mélanger toutes les lois sélectionnées
	const allShuffled = selectedLaws.sort(() => Math.random() - 0.5);

	// Ajouter les lois restantes (non sélectionnées) comme réserve supplémentaire
	const selectedIds = new Set(allShuffled.map((l) => l.id));
	const remainingLaws = eligibleLaws.filter((l) => !selectedIds.has(l.id));
	const allLaws = [...allShuffled, ...remainingLaws.sort(() => Math.random() - 0.5)];

	// 5. Séparer en quiz (15 premières) et réserve (le reste)
	const quizLaws = allLaws.slice(0, QUIZ_SIZE);
	const reservePool = allLaws.slice(QUIZ_SIZE);

	// 6. Enrichir avec les tags
	const enrichWithTags = (lawList: typeof eligibleLaws) =>
		lawList.map((law) => ({
			id: law.id,
			title: law.title,
			shortTitle: law.shortTitle,
			type: law.type,
			status: law.status,
			description: law.description,
			sourceUrl: law.sourceUrl,
			summary: law.summary,
			summaryModel: law.summaryModel,
			tags: lawTagsData
				.filter((lt) => lt.lawId === law.id)
				.map((lt) => ({
					slug: lt.slug,
					name: lt.name,
					color: lt.color
				}))
		}));

	return {
		laws: enrichWithTags(quizLaws),
		reserveLaws: enrichWithTags(reservePool)
	};
};
