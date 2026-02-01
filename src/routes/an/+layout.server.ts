import type { LayoutServerLoad } from './$types';
import { getLegislatures, getCurrentLegislature, isValidLegislature } from '$lib/server/periods/an-legislatures';

export const load: LayoutServerLoad = async ({ locals }) => {
	const legislatures = await getLegislatures();
	const currentLegislature = await getCurrentLegislature();

	// Lire la période depuis le cookie, valider, ou utiliser la période courante par défaut
	// "all" = toutes les périodes (pas de filtrage)
	let selectedLegislature = locals.periods.an;
	if (selectedLegislature === 'all') {
		// Garder "all" pour ne pas filtrer
	} else if (!selectedLegislature || !(await isValidLegislature(selectedLegislature))) {
		selectedLegislature = currentLegislature; // Par défaut: période courante
	}

	return {
		legislatures,
		currentLegislature,
		selectedLegislature
	};
};
