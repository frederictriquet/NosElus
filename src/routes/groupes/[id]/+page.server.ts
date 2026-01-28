import type { PageServerLoad } from './$types';
import { db, organs } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const [group] = await db
		.select()
		.from(organs)
		.where(eq(organs.id, params.id));

	if (!group) {
		throw error(404, 'Groupe non trouvé');
	}

	return { group };
};
