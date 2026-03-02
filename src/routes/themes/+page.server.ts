import type { PageServerLoad } from './$types';
import { getThemesWithBilan } from '$lib/server/api/helpers';

export const load: PageServerLoad = async () => {
	const themes = await getThemesWithBilan();
	return { themes };
};
