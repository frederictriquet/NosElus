/**
 * Page /themes — Liste des fiches thématiques
 *
 * Affiche tous les thèmes actifs (tags ayant au moins un scrutin tagué)
 * avec le bilan de vote résumé par groupe politique.
 */
import type { PageServerLoad } from './$types';
import { getThemesWithBilan } from '$lib/server/api/helpers';

export const load: PageServerLoad = async () => {
	const themes = await getThemesWithBilan();
	return { themes };
};
