import type { PageServerLoad } from './$types';
import { getLegislatureDates, getCurrentLegislature } from '$lib/server/periods/an-legislatures';
import { getANGroupsWithMemberCount } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ locals }) => {
	const currentLeg = await getCurrentLegislature();
	const legislature =
		locals.periods.an && locals.periods.an !== 'all' ? locals.periods.an : currentLeg;

	// Get legislature dates for reference date calculation
	const legislatureInfo = await getLegislatureDates(legislature);
	// Reference date: today for current legislature, end date for past ones
	const referenceDate = legislatureInfo?.end || new Date().toISOString().split('T')[0];

	const groups = await getANGroupsWithMemberCount(legislature, referenceDate);

	return {
		groups,
		filters: {
			legislature
		}
	};
};
