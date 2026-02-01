import type { PageServerLoad } from './$types';
import { getTermDates } from '$lib/server/periods/pe-terms';
import { getPEGroupsWithMemberCount } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ locals }) => {
	const terme = locals.periods.pe;

	// Get term dates for filtering
	const periodDates = terme && terme !== 'all' ? await getTermDates(terme) : null;

	const groups = await getPEGroupsWithMemberCount(terme, periodDates);

	return {
		groups,
		filters: {
			terme
		}
	};
};
