import type { PageServerLoad } from './$types';
import { db, actors, organs, mandates } from '$lib/server/db';
import { eq, and, sql, inArray, isNull, or, gte, notLike } from 'drizzle-orm';
import { parsePeriodFilters } from '$lib/server/api/helpers';
import { getLegislatureDates, getCurrentLegislature } from '$lib/server/legislatures';

export const load: PageServerLoad = async ({ url }) => {
	const periodFilters = parsePeriodFilters(url);

	// Cette page nécessite une législature spécifique (défaut: législature courante)
	const currentLeg = await getCurrentLegislature();
	const legislature = periodFilters.legislature || currentLeg;
	const legislatureInfo = await getLegislatureDates(legislature);

	// Date de référence : aujourd'hui pour législature en cours, date de fin pour les passées
	const referenceDate = legislatureInfo?.end || new Date().toISOString().split('T')[0];

	// Legislature label for display
	const legislatureLabel = `${legislature}ème législature`;

	// Loader pour la distribution des groupes (hémicycle + bar chart)
	const loadGroupDistribution = async () => {
		// Trouver les groupes parlementaires (GP) avec leurs membres ACTIFS dans cette législature
		const groupMandateCounts = await db
			.select({
				organId: mandates.organId,
				deputyCount: sql<number>`count(distinct case when ${mandates.endDate} is null or ${mandates.endDate} >= ${referenceDate} then ${mandates.actorId} end)`
			})
			.from(mandates)
			.innerJoin(organs, eq(organs.id, mandates.organId))
			.where(and(
				eq(mandates.legislature, legislature),
				eq(organs.type, 'GP'),
				notLike(organs.id, 'PO_GP_%')
			))
			.groupBy(mandates.organId);

		const organIds = groupMandateCounts.map(g => g.organId);

		// Récupérer les infos des groupes
		const groups = organIds.length > 0
			? await db
				.select({
					groupId: organs.id,
					groupName: organs.name,
					groupShortName: organs.shortName,
					groupColor: organs.color
				})
				.from(organs)
				.where(inArray(organs.id, organIds))
			: [];

		const countByGroup = new Map(groupMandateCounts.map(c => [c.organId, Number(c.deputyCount)]));
		const groupInfoById = new Map(groups.map(g => [g.groupId, g]));

		// Build group distribution with actual counts
		const groupDistribution = groupMandateCounts
			.map(c => {
				const info = groupInfoById.get(c.organId);
				const shortName = info?.groupShortName || c.organId;
				const fullName = info?.groupName || c.organId;
				const color = info?.groupColor || '#888';
				return {
					groupId: c.organId,
					groupName: fullName,
					groupShortName: shortName,
					groupColor: color,
					deputyCount: Number(c.deputyCount)
				};
			})
			.filter(g => g.deputyCount > 0)
			.sort((a, b) => b.deputyCount - a.deputyCount);

		const totalDeputies = groupDistribution.reduce((sum, g) => sum + g.deputyCount, 0);

		return { groupDistribution, totalDeputies };
	};

	// Loader pour les députés par groupe (plus lourd - requête par groupe)
	const loadDeputiesByGroup = async () => {
		// On a besoin de la distribution pour connaître les groupes
		const { groupDistribution } = await loadGroupDistribution();

		const deputiesByGroup: Record<string, Array<{ id: string; name: string; photoUrl: string | null }>> = {};

		// Charger tous les groupes en parallèle
		await Promise.all(groupDistribution.map(async (group) => {
			const groupMembers = await db
				.select({
					id: actors.id,
					name: actors.fullName,
					photoUrl: actors.photoUrl
				})
				.from(actors)
				.innerJoin(mandates, eq(mandates.actorId, actors.id))
				.where(and(
					eq(mandates.organId, group.groupId),
					eq(mandates.legislature, legislature),
					or(isNull(mandates.endDate), gte(mandates.endDate, referenceDate))
				))
				.orderBy(actors.lastName)
				.limit(5);

			deputiesByGroup[group.groupId] = groupMembers;
		}));

		return deputiesByGroup;
	};

	return {
		// Données synchrones (rapides, nécessaires pour la structure)
		legislature,
		legislatureLabel,
		legislatureStart: legislatureInfo?.start ?? null,
		legislatureEnd: legislatureInfo?.end ?? null,
		// Promises streamées
		groupData: loadGroupDistribution(),
		deputiesByGroup: loadDeputiesByGroup()
	};
};
