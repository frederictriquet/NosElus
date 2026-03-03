import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getThemeDetail } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params }) => {
	if (!/^[a-z0-9-]+$/.test(params.slug)) throw error(404, { message: 'Thème non trouvé' });
	const theme = await getThemeDetail(params.slug);
	if (!theme) throw error(404, { message: 'Thème non trouvé' });
	return { theme };
};
