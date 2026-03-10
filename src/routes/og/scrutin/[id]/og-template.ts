/**
 * Génère le template HTML de l'image Open Graph pour un scrutin.
 *
 * Les fonctions de ce module sont des fonctions pures exportées séparément
 * de la route +server.ts pour faciliter les tests.
 *
 * Contraintes satori (sous-ensemble CSS) :
 * - display:flex uniquement (pas de grid, pas d'inline-block)
 * - Styles inline seulement
 * - Pas de pseudo-éléments
 * - gap et border-radius sont supportés
 */

export type GroupData = {
	name: string;
	shortName: string | null;
	pour: number;
	contre: number;
	abstention: number;
};

/** Tronque une chaîne à max caractères, en ajoutant '…' si nécessaire. */
export function truncate(s: string, max: number): string {
	return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Échappe les caractères HTML spéciaux pour éviter de casser le template satori. */
export function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Formate une date ISO "YYYY-MM-DD" en français.
 * Utilise un parsing explicite pour éviter le décalage UTC.
 */
export function formatDate(dateStr: string): string {
	const [year, month, day] = dateStr.split('-').map(Number);
	return new Date(year, month - 1, day).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Génère le HTML du template OG pour un scrutin.
 *
 * @param params.title - Titre du scrutin (déjà tronqué si nécessaire)
 * @param params.date - Date formatée en français
 * @param params.result - "adopté" | "rejeté" | null
 * @param params.groups - Données de votes par groupe (tous les groupes)
 * @param params.scrutinId - Identifiant du scrutin pour l'URL source
 * @returns HTML string compatible satori (flexbox inline styles)
 */
export function buildTemplate(params: {
	title: string;
	date: string;
	result: string | null;
	groups: GroupData[];
	scrutinId: string;
}): string {
	const { title, date, result, groups, scrutinId } = params;

	const safeTitle = escapeHtml(title);
	const safeDate = escapeHtml(date);

	const resultBadge = result
		? `<div style="display:flex;padding:6px 20px;border-radius:100px;background:${result === 'adopté' ? '#14532d' : '#7f1d1d'};">
       <span style="font-size:15px;font-weight:700;color:${result === 'adopté' ? '#4ade80' : '#f87171'};">${result === 'adopté' ? 'ADOPTÉ' : 'REJETÉ'}</span>
     </div>`
		: '';

	// Agrégat global sur l'ensemble des groupes (tous les votants)
	const totalPour = groups.reduce((s, g) => s + g.pour, 0);
	const totalContre = groups.reduce((s, g) => s + g.contre, 0);
	const totalAbstention = groups.reduce((s, g) => s + g.abstention, 0);
	const grandTotal = totalPour + totalContre + totalAbstention;
	const globalPourPct = grandTotal > 0 ? Math.round((totalPour / grandTotal) * 100) : 0;
	const globalContrePct = grandTotal > 0 ? Math.round((totalContre / grandTotal) * 100) : 0;
	const globalMainPct = globalPourPct >= globalContrePct ? globalPourPct : globalContrePct;
	const globalMainLabel = globalPourPct >= globalContrePct ? 'pour' : 'contre';

	// Top 3 groupes individuels par nombre de votants
	const topGroups = groups
		.map((g) => {
			const total = g.pour + g.contre + g.abstention;
			const pourPct = total > 0 ? Math.round((g.pour / total) * 100) : 0;
			const contrePct = total > 0 ? Math.round((g.contre / total) * 100) : 0;
			return {
				label: escapeHtml(g.name),
				total,
				pourPct,
				contrePct: Math.min(contrePct, 100 - pourPct),
				mainPct: pourPct >= contrePct ? pourPct : contrePct,
				mainLabel: pourPct >= contrePct ? 'pour' : 'contre'
			};
		})
		.filter((g) => g.total > 0)
		.sort((a, b) => b.total - a.total)
		.slice(0, 3);

	const renderBar = (
		label: string,
		pourPct: number,
		contrePct: number,
		mainPct: number,
		mainLabel: string,
		isAggregate: boolean
	) =>
		`<div style="display:flex;flex-direction:row;align-items:center;gap:14px;">` +
		`<span style="display:flex;font-size:${isAggregate ? '14px' : '12px'};font-weight:${isAggregate ? '700' : '400'};color:${isAggregate ? '#e2e8f0' : '#94a3b8'};width:180px;flex-shrink:0;overflow:hidden;">${label}</span>` +
		`<div style="display:flex;flex:1;height:${isAggregate ? '12px' : '8px'};background:#1e293b;border-radius:5px;overflow:hidden;">` +
		`<div style="display:flex;width:${pourPct}%;height:100%;background:#22c55e;"></div>` +
		`<div style="display:flex;width:${contrePct}%;height:100%;background:#ef4444;"></div>` +
		`</div>` +
		`<span style="display:flex;font-size:13px;color:${isAggregate ? '#e2e8f0' : '#94a3b8'};width:90px;justify-content:flex-end;">${mainPct}% ${mainLabel}</span>` +
		`</div>`;

	const separator =
		topGroups.length > 0
			? `<div style="display:flex;height:1px;background:#1e293b;margin:2px 0;"></div>`
			: '';

	const groupsHtml =
		grandTotal > 0
			? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:24px;">` +
				renderBar(
					'Résultat global',
					globalPourPct,
					Math.min(globalContrePct, 100 - globalPourPct),
					globalMainPct,
					globalMainLabel,
					true
				) +
				separator +
				topGroups
					.map((g) => renderBar(g.label, g.pourPct, g.contrePct, g.mainPct, g.mainLabel, false))
					.join('') +
				`</div>`
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
      <div style="display:flex;font-size:${titleSize};font-weight:700;color:#f1f5f9;line-height:1.2;margin-bottom:24px;">${safeTitle}</div>
      <div style="display:flex;flex-direction:row;align-items:center;gap:16px;">
        <span style="font-size:20px;color:#64748b;">${safeDate}</span>
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
