import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, searchSynonyms } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const synonyms = await db.select().from(searchSynonyms).orderBy(searchSynonyms.term);

	return { synonyms };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const data = await request.formData();
		const term = (data.get('term') as string)?.trim().toUpperCase();
		const expansion = (data.get('expansion') as string)?.trim();

		if (!term || term.length < 2) return fail(400, { error: 'Terme trop court' });
		if (!expansion || expansion.length < 3) return fail(400, { error: 'Expansion trop courte' });

		await db
			.insert(searchSynonyms)
			.values({ term, expansion })
			.onConflictDoUpdate({
				target: searchSynonyms.term,
				set: { expansion, updatedAt: new Date() }
			});

		return { success: true };
	},

	delete: async ({ request }) => {
		const data = await request.formData();
		const term = data.get('term') as string;

		if (!term) return fail(400, { error: 'Terme manquant' });

		await db.delete(searchSynonyms).where(eq(searchSynonyms.term, term));
		return { success: true };
	}
};
