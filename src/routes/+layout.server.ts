import type { LayoutServerLoad } from './$types';
import { getLegislatures, getCurrentLegislature } from '$lib/server/legislatures';

export const load: LayoutServerLoad = async () => {
	const legislatures = await getLegislatures();
	const currentLegislature = await getCurrentLegislature();

	return {
		legislatures,
		currentLegislature
	};
};
