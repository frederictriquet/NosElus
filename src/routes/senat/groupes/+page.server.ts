import type { PageServerLoad } from './$types';
import { getRenouvellementDates } from '$lib/server/periods/senat-renouvellements';
import { getSenatGroupsWithMemberCount } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ locals }) => {
	const renouvellement = locals.periods.senat;

	// Get renouvellement dates for filtering
	const periodDates =
		renouvellement && renouvellement !== 'all'
			? await getRenouvellementDates(renouvellement)
			: null;

	const groups = await getSenatGroupsWithMemberCount(periodDates);

	return {
		groups,
		filters: {
			renouvellement
		}
	};
};
