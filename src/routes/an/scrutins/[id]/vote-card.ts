/**
 * Génère le texte d'une carte de vote partageable.
 *
 * Format :
 *   📊 VOTE : Augmentation du SMIC à 1500€ net
 *   📅 20 juillet 2022 — Assemblée Nationale
 *
 *   ✅ Pour       : NFP (100%), PCF (100%)
 *   ❌ Contre     : RN (94%), LR (87%), Ensemble (72%)
 *   🟡 Abstention : —
 *
 *   Source : nosElus.fr/an/scrutins/VTANR5L16V0063
 */

export type VoteCardGroup = {
	name: string;
	shortName: string | null;
	pour: number;
	contre: number;
	abstention: number;
};

export type VoteCardScrutin = {
	id: string;
	title: string;
	titleSimple: string | null;
	date: string; // ISO date string "YYYY-MM-DD"
};

export function formatVoteCard(scrutin: VoteCardScrutin, groups: VoteCardGroup[]): string {
	const titre = scrutin.titleSimple ?? scrutin.title;
	const date = new Date(scrutin.date).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	const votingTotal = (g: VoteCardGroup) => g.pour + g.contre + g.abstention;

	const formatGroups = (
		filtered: VoteCardGroup[],
		getVal: (g: VoteCardGroup) => number
	): string => {
		if (filtered.length === 0) return '—';
		return filtered
			.sort((a, b) => getVal(b) / votingTotal(b) - getVal(a) / votingTotal(a))
			.map((g) => {
				const name = g.shortName ?? g.name;
				const pct = Math.round((getVal(g) / votingTotal(g)) * 100);
				return `${name} (${pct}%)`;
			})
			.join(', ');
	};

	return [
		`📊 VOTE : ${titre}`,
		`📅 ${date} — Assemblée Nationale`,
		'',
		`✅ Pour       : ${formatGroups(
			groups.filter((g) => g.pour > 0),
			(g) => g.pour
		)}`,
		`❌ Contre     : ${formatGroups(
			groups.filter((g) => g.contre > 0),
			(g) => g.contre
		)}`,
		`🟡 Abstention : ${formatGroups(
			groups.filter((g) => g.abstention > 0),
			(g) => g.abstention
		)}`,
		'',
		`Source : nosElus.fr/an/scrutins/${scrutin.id}`
	].join('\n');
}
