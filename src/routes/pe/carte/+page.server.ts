import type { PageServerLoad } from './$types';
import { db, actors, organs, mandates } from '$lib/server/db';
import { eq, and, sql, inArray, isNull, or, gte, like } from 'drizzle-orm';
import { getTermDates, getCurrentTerm } from '$lib/server/periods/pe-terms';

export const load: PageServerLoad = async ({ locals }) => {
	// Cette page nécessite un terme spécifique (défaut: terme courant)
	// "all" n'est pas supporté sur cette page, on utilise la période courante
	const currentTerm = await getCurrentTerm();
	const terme = locals.periods.pe && locals.periods.pe !== 'all' ? locals.periods.pe : currentTerm;
	const termInfo = await getTermDates(terme);

	// Date de référence : aujourd'hui pour terme en cours, date de fin pour les passés
	const referenceDate = termInfo?.end || new Date().toISOString().split('T')[0];

	// Term label for display
	const termLabel = `${terme}e législature`;

	// Loader pour la distribution des groupes (hémicycle + bar chart)
	const loadGroupDistribution = async () => {
		// Trouver les groupes parlementaires PE (GPEU-*) avec leurs membres ACTIFS dans ce terme
		const groupMandateCounts = await db
			.select({
				organId: mandates.organId,
				mepCount: sql<number>`count(distinct case when ${mandates.endDate} is null or ${mandates.endDate} >= ${referenceDate} then ${mandates.actorId} end)`
			})
			.from(mandates)
			.innerJoin(organs, eq(organs.id, mandates.organId))
			.innerJoin(actors, eq(actors.id, mandates.actorId))
			.where(
				and(
					eq(mandates.legislature, terme),
					eq(organs.type, 'GP'),
					eq(organs.chamber, 'PE'),
					eq(actors.chamber, 'PE'),
					like(mandates.organId, 'GPEU-%')
				)
			)
			.groupBy(mandates.organId);

		const organIds = groupMandateCounts.map((g) => g.organId);

		// Récupérer les infos des groupes
		const groups =
			organIds.length > 0
				? await db
						.select({
							groupId: organs.id,
							groupName: organs.name,
							groupShortName: organs.shortName,
							groupColor: organs.color,
							politicalPosition: organs.politicalPosition
						})
						.from(organs)
						.where(inArray(organs.id, organIds))
				: [];

		const countByGroup = new Map(groupMandateCounts.map((c) => [c.organId, Number(c.mepCount)]));
		const groupInfoById = new Map(groups.map((g) => [g.groupId, g]));

		// Build group distribution with actual counts
		const groupDistribution = groupMandateCounts
			.map((c) => {
				const info = groupInfoById.get(c.organId);
				const shortName = info?.groupShortName || c.organId;
				const fullName = info?.groupName || c.organId;
				const color = info?.groupColor || '#888';
				const politicalPosition = info?.politicalPosition ?? null;
				return {
					groupId: c.organId,
					groupName: fullName,
					groupShortName: shortName,
					groupColor: color,
					mepCount: Number(c.mepCount),
					politicalPosition
				};
			})
			.filter((g) => g.mepCount > 0)
			.sort((a, b) => b.mepCount - a.mepCount);

		const totalMeps = groupDistribution.reduce((sum, g) => sum + g.mepCount, 0);

		return { groupDistribution, totalMeps };
	};

	// Loader pour les eurodéputés par groupe (plus lourd - requête par groupe)
	const loadMepsByGroup = async () => {
		// On a besoin de la distribution pour connaître les groupes
		const { groupDistribution } = await loadGroupDistribution();

		const mepsByGroup: Record<
			string,
			Array<{ id: string; name: string; photoUrl: string | null }>
		> = {};

		// Charger tous les groupes en parallèle
		await Promise.all(
			groupDistribution.map(async (group) => {
				const groupMembers = await db
					.select({
						id: actors.id,
						name: actors.fullName,
						photoUrl: actors.photoUrl
					})
					.from(actors)
					.innerJoin(mandates, eq(mandates.actorId, actors.id))
					.where(
						and(
							eq(mandates.organId, group.groupId),
							eq(mandates.legislature, terme),
							eq(actors.chamber, 'PE'),
							or(isNull(mandates.endDate), gte(mandates.endDate, referenceDate))
						)
					)
					.orderBy(actors.lastName)
					.limit(5);

				mepsByGroup[group.groupId] = groupMembers;
			})
		);

		return mepsByGroup;
	};

	return {
		// Données synchrones (rapides, nécessaires pour la structure)
		terme,
		termLabel,
		termStart: termInfo?.start ?? null,
		termEnd: termInfo?.end ?? null,
		// Promises streamées
		groupData: loadGroupDistribution(),
		mepsByGroup: loadMepsByGroup()
	};
};
