import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { ImageResponse } from '@ethercorps/sveltekit-og';
import { db, scrutins, votes, organs } from '$lib/server/db';
import { eq, count } from 'drizzle-orm';

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

function truncate(s: string, max: number): string {
	return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function formatDate(dateStr: string): string {
	const [year, month, day] = dateStr.split('-').map(Number);
	return new Date(year, month - 1, day).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

type GroupData = {
	name: string;
	shortName: string | null;
	pour: number;
	contre: number;
	abstention: number;
};

/**
 * Génère le template HTML de l'image OG.
 * Utilise uniquement des styles inline compatibles avec Satori (flexbox, pas de grid).
 */
function buildTemplate(params: {
	title: string;
	date: string;
	result: string | null;
	groups: GroupData[];
	scrutinId: string;
}): string {
	const { title, date, result, groups, scrutinId } = params;

	const resultBadge = result
		? `<div style="display:flex;padding:6px 20px;border-radius:100px;background:${result === 'adopté' ? '#14532d' : '#7f1d1d'};">
       <span style="font-size:15px;font-weight:700;color:${result === 'adopté' ? '#4ade80' : '#f87171'};">${result === 'adopté' ? 'ADOPTÉ' : 'REJETÉ'}</span>
     </div>`
		: '';

	const topGroups = groups
		.map((g) => {
			const total = g.pour + g.contre + g.abstention;
			const pourPct = total > 0 ? Math.round((g.pour / total) * 100) : 0;
			const contrePct = total > 0 ? Math.round((g.contre / total) * 100) : 0;
			return {
				label: g.shortName ?? g.name,
				total,
				pourPct,
				// Clamp pour éviter le dépassement visuel dû aux arrondis
				contrePct: Math.min(contrePct, 100 - pourPct),
				mainPct: pourPct >= contrePct ? pourPct : contrePct,
				mainLabel: pourPct >= contrePct ? 'pour' : 'contre'
			};
		})
		.filter((g) => g.total > 0)
		.sort((a, b) => b.total - a.total)
		.slice(0, 4);

	const groupsHtml =
		topGroups.length > 0
			? `<div style="display:flex;flex-direction:column;gap:10px;margin-top:28px;">
        ${topGroups
					.map(
						(g) => `<div style="display:flex;flex-direction:row;align-items:center;gap:14px;">
            <span style="display:flex;font-size:14px;color:#94a3b8;width:72px;flex-shrink:0;">${g.label}</span>
            <div style="display:flex;flex:1;height:10px;background:#1e293b;border-radius:5px;overflow:hidden;">
              <div style="display:flex;width:${g.pourPct}%;height:10px;background:#22c55e;"></div>
              <div style="display:flex;width:${g.contrePct}%;height:10px;background:#ef4444;"></div>
            </div>
            <span style="display:flex;font-size:13px;color:#94a3b8;width:90px;justify-content:flex-end;">${g.mainPct}% ${g.mainLabel}</span>
          </div>`
					)
					.join('')}
      </div>`
			: '';

	const titleSize = title.length > 60 ? '36px' : '44px';

	return `<div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#0f172a;padding:56px 64px;font-family:Inter,sans-serif;">
    <div style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;margin-bottom:44px;">
      <span style="font-size:28px;font-weight:800;color:#3b82f6;">NosElus</span>
      <span style="font-size:16px;color:#475569;">Assemblée Nationale</span>
    </div>
    <div style="display:flex;flex-direction:column;flex:1;">
      <div style="display:flex;margin-bottom:14px;">
        <span style="font-size:12px;font-weight:700;color:#3b82f6;letter-spacing:3px;">VOTE OFFICIEL</span>
      </div>
      <div style="display:flex;font-size:${titleSize};font-weight:700;color:#f1f5f9;line-height:1.2;margin-bottom:24px;">${title}</div>
      <div style="display:flex;flex-direction:row;align-items:center;gap:16px;">
        <span style="font-size:20px;color:#64748b;">${date}</span>
        ${resultBadge}
      </div>
    </div>
    ${groupsHtml}
    <div style="display:flex;height:1px;background:#1e293b;margin-top:24px;margin-bottom:20px;"></div>
    <div style="display:flex;">
      <span style="font-size:15px;color:#334155;">noselus.fr/an/scrutins/${scrutinId}</span>
    </div>
  </div>`;
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
