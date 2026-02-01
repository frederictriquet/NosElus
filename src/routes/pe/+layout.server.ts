import type { LayoutServerLoad } from './$types';
import { getTerms, getCurrentTerm, isValidTerm } from '$lib/server/periods/pe-terms';

export const load: LayoutServerLoad = async ({ locals }) => {
	const terms = await getTerms();
	const currentTerm = await getCurrentTerm();

	// Lire la période depuis le cookie, valider, ou utiliser la période courante par défaut
	// "all" = toutes les périodes (pas de filtrage)
	let selectedTerm = locals.periods.pe;
	if (selectedTerm === 'all') {
		// Garder "all" pour ne pas filtrer
	} else if (!selectedTerm || !(await isValidTerm(selectedTerm))) {
		selectedTerm = currentTerm; // Par défaut: période courante
	}

	return {
		terms,
		currentTerm,
		selectedTerm
	};
};
