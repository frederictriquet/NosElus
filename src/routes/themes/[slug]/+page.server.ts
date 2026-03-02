import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getThemeDetail } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params }) => {
	const theme = await getThemeDetail(params.slug);
	if (!theme) throw error(404, { message: 'Thème non trouvé' });
	return { theme };
};
