import type { LayoutServerLoad } from './$types';
import {
	getRenouvellements,
	getCurrentRenouvellement,
	isValidRenouvellement
} from '$lib/server/periods/senat-renouvellements';

export const load: LayoutServerLoad = async ({ locals }) => {
	const renouvellements = await getRenouvellements();
	const currentRenouvellement = await getCurrentRenouvellement();

	// Lire la période depuis le cookie, valider, ou utiliser la période courante par défaut
	// "all" = toutes les périodes (pas de filtrage)
	let selectedRenouvellement = locals.periods.senat;
	if (selectedRenouvellement === 'all') {
		// Garder "all" pour ne pas filtrer
	} else if (!selectedRenouvellement || !(await isValidRenouvellement(selectedRenouvellement))) {
		selectedRenouvellement = currentRenouvellement; // Par défaut: période courante
	}

	return {
		renouvellements,
		currentRenouvellement,
		selectedRenouvellement
	};
};
