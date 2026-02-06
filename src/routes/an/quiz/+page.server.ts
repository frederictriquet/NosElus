import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { laws, law_summaries, law_tags, tags, scrutins } from '$lib/server/db/schema';
import { eq, inArray, sql, and, desc } from 'drizzle-orm';

/**
 * Sélectionne les lois pour le quiz politique.
 *
 * Implémente l'algorithme de sélection mixte (ADR-006) :
 * - Filtre : lois avec résumé IA + au moins 3 scrutins (lois débattues)
 * - Stratification : diversité thématique via tags
 * - Randomisation : sélection aléatoire dans chaque groupe de tags
 *
 * @returns 15 lois avec résumés, tags, et métadonnées
 */
export const load: PageServerLoad = async () => {
	const QUIZ_SIZE = 15;
	const MIN_SCRUTINS = 3;
	const LEGISLATURE = '17';

	// 1. Récupérer toutes les lois éligibles avec leur nombre de scrutins
	const eligibleLaws = await db
		.select({
			id: laws.id,
			title: laws.title,
			shortTitle: laws.shortTitle,
			summary: lawSummaries.summary,
			scrutinCount: sql<number>`COUNT(DISTINCT ${scrutins.id})::int`
		})
		.from(laws)
		.innerJoin(lawSummaries, eq(laws.id, lawSummaries.lawId))
		.innerJoin(scrutins, eq(laws.id, scrutins.lawId))
		.where(eq(laws.legislature, LEGISLATURE))
		.groupBy(laws.id, lawSummaries.summary)
		.having(sql`COUNT(DISTINCT ${scrutins.id}) >= ${MIN_SCRUTINS}`)
		.orderBy(desc(sql`COUNT(DISTINCT ${scrutins.id})`));

	if (eligibleLaws.length === 0) {
		return { laws: [] };
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

	// 4. Stratifier : prendre des lois de chaque tag aléatoirement
	const selectedLaws: typeof eligibleLaws = [];
	const tagArray = Array.from(lawsByTag.entries());

	// Calculer combien de lois par tag (équilibré)
	const lawsPerTag = Math.ceil(QUIZ_SIZE / tagArray.length);

	for (const [, tagLaws] of tagArray) {
		// Mélanger et prendre N lois de ce tag
		const shuffled = tagLaws.sort(() => Math.random() - 0.5);
		selectedLaws.push(...shuffled.slice(0, lawsPerTag));

		// Arrêter si on a assez de lois
		if (selectedLaws.length >= QUIZ_SIZE) break;
	}

	// 5. Limiter à QUIZ_SIZE et mélanger une dernière fois
	const finalSelection = selectedLaws.slice(0, QUIZ_SIZE).sort(() => Math.random() - 0.5);

	// 6. Enrichir avec les tags
	const finalLawIds = finalSelection.map((l) => l.id);
	const finalTagsData = lawTagsData.filter((lt) => finalLawIds.includes(lt.lawId));

	const lawsWithTags = finalSelection.map((law) => ({
		id: law.id,
		title: law.title,
		shortTitle: law.shortTitle,
		summary: law.summary,
		tags: finalTagsData
			.filter((lt) => lt.lawId === law.id)
			.map((lt) => ({
				slug: lt.slug,
				name: lt.name,
				color: lt.color
			}))
	}));

	return {
		laws: lawsWithTags
	};
};
