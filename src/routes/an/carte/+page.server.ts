import type { PageServerLoad } from './$types';
import { db, actors, mandates } from '$lib/server/db';
import { eq, and, isNull, or, gte } from 'drizzle-orm';
import { getLegislatureDates, getCurrentLegislature } from '$lib/server/periods/an-legislatures';
import { getANGroupsWithMemberCount } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ locals }) => {
	// Cette page nécessite une législature spécifique (défaut: législature courante)
	// "all" n'est pas supporté sur cette page, on utilise la période courante
	const currentLeg = await getCurrentLegislature();
	const legislature = (locals.periods.an && locals.periods.an !== 'all') ? locals.periods.an : currentLeg;
	const legislatureInfo = await getLegislatureDates(legislature);

	// Date de référence : aujourd'hui pour législature en cours, date de fin pour les passées
	const referenceDate = legislatureInfo?.end || new Date().toISOString().split('T')[0];

	// Legislature label for display
	const legislatureLabel = `${legislature}ème législature`;

	// Loader pour la distribution des groupes (hémicycle + bar chart)
	const loadGroupDistribution = async () => {
		const groups = await getANGroupsWithMemberCount(legislature, referenceDate);

		// Map to expected format for this page
		const groupDistribution = groups.map(g => ({
			groupId: g.id,
			groupName: g.name || g.id,
			groupShortName: g.shortName || g.id,
			groupColor: g.color || '#888',
			deputyCount: g.memberCount,
			politicalPosition: g.politicalPosition
		}));

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
