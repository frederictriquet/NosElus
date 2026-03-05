/**
 * Page /themes/[slug] — Fiche thématique détaillée
 *
 * Affiche le bilan complet par groupe politique et la liste des scrutins
 * associés à un thème identifié par son slug (ex: "pouvoir-achat").
 *
 * Retourne 404 si le slug ne respecte pas le format attendu (a-z, 0-9, tirets)
 * ou si le thème n'existe pas en base.
 */
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getThemeDetail } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params }) => {
	if (!/^[a-z0-9-]+$/.test(params.slug)) throw error(404, { message: 'Thème non trouvé' });
	const theme = await getThemeDetail(params.slug);
	if (!theme) throw error(404, { message: 'Thème non trouvé' });
	return { theme };
};
