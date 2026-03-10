import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { ImageResponse } from '@ethercorps/sveltekit-og';
import { db, scrutins, votes, organs } from '$lib/server/db';
import { eq, count } from 'drizzle-orm';
import { truncate, formatDate, buildTemplate, type GroupData } from './og-template';

/** Module-level cache — la police est chargée une seule fois par process */
let cachedFont: ArrayBuffer | null = null;

async function loadFont(origin: string): Promise<ArrayBuffer> {
	if (!cachedFont) {
		const res = await fetch(`${origin}/fonts/Inter-Regular.ttf`);
		if (!res.ok) throw new Error(`Chargement police échoué: ${res.status}`);
		cachedFont = await res.arrayBuffer();
	}
	return cachedFont;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const [scrutin] = await db
		.select({
			id: scrutins.id,
			title: scrutins.title,
			titleSimple: scrutins.titleSimple,
			date: scrutins.date,
			result: scrutins.result
		})
		.from(scrutins)
		.where(eq(scrutins.id, params.id));

	if (!scrutin) throw error(404, 'Scrutin non trouvé');

	const groupVotes = await db
		.select({
			groupId: votes.groupId,
			groupName: organs.name,
			groupShortName: organs.shortName,
			position: votes.position,
			count: count()
		})
		.from(votes)
		.leftJoin(organs, eq(votes.groupId, organs.id))
		.where(eq(votes.scrutinId, params.id))
		.groupBy(votes.groupId, organs.name, organs.shortName, votes.position);

	const groupMap = new Map<string, GroupData>();
	for (const row of groupVotes) {
		if (!row.groupId) continue;
		if (!groupMap.has(row.groupId)) {
			groupMap.set(row.groupId, {
				name: row.groupName ?? 'Inconnu',
				shortName: row.groupShortName,
				pour: 0,
				contre: 0,
				abstention: 0
			});
		}
		const g = groupMap.get(row.groupId)!;
		const pos = row.position?.toLowerCase() ?? '';
		if (pos === 'pour') g.pour += row.count;
		else if (pos === 'contre') g.contre += row.count;
		else if (pos === 'abstention') g.abstention += row.count;
	}

	const rawTitle = scrutin.titleSimple ?? scrutin.title;
	const font = await loadFont(url.origin);

	const html = buildTemplate({
		title: truncate(rawTitle, 80),
		date: formatDate(scrutin.date),
		result: scrutin.result,
		groups: Array.from(groupMap.values()),
		scrutinId: scrutin.id
	});

	return new ImageResponse(html, {
		width: 1200,
		height: 630,
		fonts: [{ name: 'Inter', data: font, weight: 400, style: 'normal' }]
	});
};
