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
 * - flex-wrap est supporté
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
 * Génère le HTML du template OG pour un scrutin (1200×630px).
 *
 * Layout :
 * - Header : logo NosElus + "Assemblée Nationale"
 * - Corps : étiquette "VOTE OFFICIEL", titre, date, badge adopté/rejeté
 * - Section votes (si données disponibles) :
 *   - Barre agrégat globale (jauge pour/contre pleine largeur)
 *   - Grille 3 colonnes listant tous les groupes ayant voté,
 *     triés par nombre de votants décroissant
 * - Footer : URL du scrutin + note de tri
 *
 * Couleur des groupes : vert (#22c55e) si majoritairement pour,
 * rouge (#ef4444) si majoritairement contre, gris (#475569) si égalité.
 *
 * @param params.title - Titre du scrutin (titleSimple si disponible, sinon title brut)
 * @param params.date - Date formatée en français (ex. "20 juillet 2022")
 * @param params.result - "adopté" | "rejeté" | null
 * @param params.groups - Données de votes par groupe (tous les groupes, non filtrés)
 * @param params.scrutinId - Identifiant du scrutin pour l'URL source
 * @returns HTML string compatible satori (flexbox inline styles uniquement)
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
	const globalMainLabel =
		globalPourPct > globalContrePct ? 'pour' : globalContrePct > globalPourPct ? 'contre' : 'abs';

	// Tous les groupes avec des votes, triés par nombre de votants décroissant
	const allGroups = groups
		.map((g) => {
			const total = g.pour + g.contre + g.abstention;
			const pourPct = total > 0 ? Math.round((g.pour / total) * 100) : 0;
			const contrePct = total > 0 ? Math.round((g.contre / total) * 100) : 0;
			const mainPct = pourPct >= contrePct ? pourPct : contrePct;
			const mainLabel = pourPct > contrePct ? 'pour' : contrePct > pourPct ? 'contre' : 'abs';
			const color = pourPct > contrePct ? '#22c55e' : contrePct > pourPct ? '#ef4444' : '#475569';
			return {
				label: escapeHtml(g.name),
				total,
				pourPct,
				contrePct: Math.min(contrePct, 100 - pourPct),
				mainPct,
				mainLabel,
				color
			};
		})
		.filter((g) => g.total > 0)
		.sort((a, b) => b.total - a.total);

	// Barre agrégat globale (pleine largeur avec jauge)
	const renderAggregateBar = (
		pourPct: number,
		contrePct: number,
		mainPct: number,
		mainLabel: string
	) =>
		`<div style="display:flex;flex-direction:row;align-items:center;gap:14px;">` +
		`<span style="display:flex;font-size:14px;font-weight:700;color:#e2e8f0;width:180px;flex-shrink:0;overflow:hidden;">Résultat global</span>` +
		`<div style="display:flex;flex:1;height:12px;background:#1e293b;border-radius:5px;overflow:hidden;">` +
		`<div style="display:flex;width:${pourPct}%;height:100%;background:#22c55e;"></div>` +
		`<div style="display:flex;width:${contrePct}%;height:100%;background:#ef4444;"></div>` +
		`</div>` +
		`<span style="display:flex;font-size:13px;color:#e2e8f0;width:90px;justify-content:flex-end;">${mainPct}% ${mainLabel}</span>` +
		`</div>`;

	// Vignette compacte pour chaque groupe (une ligne par groupe dans sa colonne)
	const renderCompactGroup = (g: (typeof allGroups)[0]) =>
		`<div style="display:flex;flex-direction:row;align-items:center;gap:6px;">` +
		`<div style="display:flex;width:7px;height:7px;border-radius:4px;background:${g.color};flex-shrink:0;"></div>` +
		`<span style="display:flex;flex:1;font-size:14px;color:#64748b;overflow:hidden;">${g.label}</span>` +
		`<span style="display:flex;font-size:14px;font-weight:700;color:${g.color};width:84px;justify-content:flex-end;">${g.mainPct}% ${g.mainLabel}</span>` +
		`</div>`;

	// Séparateur vertical entre colonnes
	const colDivider = `<div style="display:flex;width:1px;background:#1e293b;margin:0 14px;"></div>`;

	// Répartition en 3 colonnes équilibrées : chaque taille est arrondie au
	// supérieur pour que la colonne 3 ne soit jamais plus longue que les autres.
	const renderThreeColumns = (items: typeof allGroups) => {
		const n = items.length;
		const s1 = Math.ceil(n / 3);
		const s2 = Math.ceil((n - s1) / 2);
		const cols = [items.slice(0, s1), items.slice(s1, s1 + s2), items.slice(s1 + s2)];
		return (
			`<div style="display:flex;flex-direction:row;">` +
			cols
				.map(
					(col) =>
						`<div style="display:flex;flex:1;flex-direction:column;gap:5px;">` +
						col.map(renderCompactGroup).join('') +
						`</div>`
				)
				.join(colDivider) +
			`</div>`
		);
	};

	const groupsHtml =
		grandTotal > 0
			? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:20px;">` +
				renderAggregateBar(
					globalPourPct,
					Math.min(globalContrePct, 100 - globalPourPct),
					globalMainPct,
					globalMainLabel
				) +
				(allGroups.length > 0
					? `<div style="display:flex;height:1px;background:#1e293b;margin:2px 0;"></div>` +
						renderThreeColumns(allGroups)
					: '') +
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
    <div style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;">
      <span style="font-size:15px;color:#334155;">noselus.fr/an/scrutins/${scrutinId}</span>
      <span style="font-size:12px;color:#475569;">groupes triés par nombre de votants</span>
    </div>
  </div>`;
}
