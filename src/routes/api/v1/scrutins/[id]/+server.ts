import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, scrutins } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	const [scrutin] = await db.select().from(scrutins).where(eq(scrutins.id, id)).limit(1);

	if (!scrutin) {
		throw error(404, { message: 'Scrutin not found' });
	}

	return json({ data: scrutin });
};
