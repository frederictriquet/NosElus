import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, searchNoiseWords } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const words = await db.select().from(searchNoiseWords).orderBy(searchNoiseWords.word);
	return { words };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const data = await request.formData();
		const word = (data.get('word') as string)?.trim().toLowerCase();

		if (!word || word.length < 2) return fail(400, { error: 'Mot trop court' });

		await db.insert(searchNoiseWords).values({ word }).onConflictDoNothing();

		return { success: true };
	},

	delete: async ({ request }) => {
		const data = await request.formData();
		const word = data.get('word') as string;

		if (!word) return fail(400, { error: 'Mot manquant' });

		await db.delete(searchNoiseWords).where(eq(searchNoiseWords.word, word));
		return { success: true };
	}
};
