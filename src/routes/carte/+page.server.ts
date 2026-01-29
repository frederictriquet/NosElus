import type { PageServerLoad } from './$types';
import { db, actors, organs, mandates } from '$lib/server/db';
import { eq, and, sql, inArray, isNull, or, gte } from 'drizzle-orm';
import { parsePeriodFilters, LEGISLATURE_DATES } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ url }) => {
	const periodFilters = parsePeriodFilters(url);

	// Cette page nécessite une législature spécifique (défaut: 17e)
	const legislature = periodFilters.legislature || '17';
	const legislatureInfo = LEGISLATURE_DATES[legislature];

	// Date de référence : aujourd'hui pour législature en cours, date de fin pour les passées
	const referenceDate = legislatureInfo?.end || new Date().toISOString().split('T')[0];

	// Trouver les groupes parlementaires (GP) avec leurs membres ACTIFS dans cette législature
	// Un mandat est actif à la date de référence si endDate est null ou >= referenceDate
	const groupMandateCounts = await db
		.select({
			organId: mandates.organId,
			deputyCount: sql<number>`count(distinct case when ${mandates.endDate} is null or ${mandates.endDate} >= ${referenceDate} then ${mandates.actorId} end)`
		})
		.from(mandates)
		.innerJoin(organs, eq(organs.id, mandates.organId))
		.where(and(
			eq(mandates.legislature, legislature),
			eq(organs.type, 'GP')
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
			return {
				groupId: c.organId,
				groupName: info?.groupName || c.organId,
				groupShortName: info?.groupShortName || c.organId,
				groupColor: info?.groupColor || '#888',
				deputyCount: Number(c.deputyCount)
			};
		})
		.filter(g => g.deputyCount > 0)
		.sort((a, b) => b.deputyCount - a.deputyCount);

	// Get total deputies for the legislature
	const totalDeputies = groupDistribution.reduce((sum, g) => sum + g.deputyCount, 0);

	// Get sample deputies per group (members active at reference date)
	const deputiesByGroup: Record<string, Array<{ id: string; name: string; photoUrl: string | null }>> = {};

	for (const group of groupDistribution) {
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
	}

	// Legislature label for display
	const legislatureLabel = `${legislature}ème législature`;

	return {
		groupDistribution,
		totalDeputies,
		deputiesByGroup,
		legislature,
		legislatureLabel,
		legislatureStart: legislatureInfo?.start || null,
		legislatureEnd: legislatureInfo?.end || null
	};
};
