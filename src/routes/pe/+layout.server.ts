import type { LayoutServerLoad } from './$types';
import { getTerms, getCurrentTerm } from '$lib/server/periods/pe-terms';

export const load: LayoutServerLoad = async () => {
	const terms = getTerms();
	const currentTerm = getCurrentTerm();

	return {
		terms,
		currentTerm
	};
};
