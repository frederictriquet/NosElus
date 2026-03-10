import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { ImageResponse } from '@ethercorps/sveltekit-og';
import { db, scrutins, votes, organs } from '$lib/server/db';
import { eq, count } from 'drizzle-orm';
import { truncate, formatDate, buildTemplate, type GroupData } from './og-template';

type GroupVoteRow = {
	groupId: string | null;
	groupName: string | null;
	groupShortName: string | null;
	position: string | null;
	count: number;
};

/**
 * Agrège les lignes de votes par groupe en une Map `groupId → GroupData`.
 * Chaque ligne représente un (groupe, position) ; la fonction cumule les compteurs.
 */
function aggregateGroupVotes(rows: GroupVoteRow[]): Map<string, GroupData> {
	const groupMap = new Map<string, GroupData>();
	for (const row of rows) {
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
	return groupMap;
}

/**
 * Cache la promesse de chargement de la police pour éviter toute race condition :
 * plusieurs requêtes concurrentes au démarrage partagent la même promesse.
 */
let fontPromise: Promise<ArrayBuffer> | null = null;

/**
 * Charge la police Inter depuis les assets statiques du serveur.
 * Le résultat est mis en cache au niveau du module via une promesse partagée,
 * garantissant un seul fetch même en cas de requêtes concurrentes au démarrage.
 *
 * @param origin - Origine du serveur (ex. "https://noselus.fr") pour construire l'URL absolue
 */
async function loadFont(origin: string): Promise<ArrayBuffer> {
	if (!fontPromise) {
		fontPromise = fetch(`${origin}/fonts/Inter-Regular.ttf`).then((res) => {
			if (!res.ok) throw new Error(`Chargement police échoué: ${res.status}`);
			return res.arrayBuffer();
		});
	}
	return fontPromise;
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

	const groupMap = aggregateGroupVotes(groupVotes);

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
