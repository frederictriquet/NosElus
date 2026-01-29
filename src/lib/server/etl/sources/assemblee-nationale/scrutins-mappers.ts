import type { ANScrutin, ANScrutinGroupe, ANScrutinVotant } from './scrutins-types';
import type { NewScrutin, NewVote } from '../../../db';

/**
 * Mappe un scrutin AN vers notre schéma Scrutin
 */
export function mapScrutin(scrutin: ANScrutin): NewScrutin {
	const s = scrutin.scrutin;
	const decompte = s.syntheseVote.decompte;

	// Parse result
	const result = s.sort.code === 'adopté' ? 'adopté' : 'rejeté';

	// Build group results JSON
	const groupResults = buildGroupResults(s);

	return {
		id: s.uid,
		uid: s.uid,
		number: parseInt(s.numero, 10),
		legislature: s.legislature,
		sessionOrdinary: s.sessionRef || null,
		sessionExtraordinary: null,
		date: s.dateScrutin,
		title: s.titre,
		type: mapScrutinType(s.typeVote.codeTypeVote),
		sortType: s.sort.code,
		totalVoters: parseInt(s.syntheseVote.nombreVotants, 10) || 0,
		totalFor: parseInt(decompte.pour, 10) || 0,
		totalAgainst: parseInt(decompte.contre, 10) || 0,
		totalAbstention: parseInt(decompte.abstentions, 10) || 0,
		totalNonVoting: parseInt(decompte.nonVotants, 10) || 0,
		result,
		groupResults,
		lawId: null,
		amendmentRef: null,
		description: s.objet?.libelle || null
	};
}

/**
 * Mappe le type de vote AN vers notre format
 */
function mapScrutinType(codeTypeVote: string): string {
	switch (codeTypeVote) {
		case 'SPS':
			return 'SPS'; // Scrutin public solennel
		case 'SPO':
			return 'SPO'; // Scrutin public ordinaire
		case 'MOC':
			return 'MOC'; // Motion de censure
		case 'CRG':
			return 'CRG'; // Confiance / Responsabilité du Gouvernement
		default:
			return 'SPO';
	}
}

/**
 * Construit le JSON des résultats par groupe
 */
function buildGroupResults(
	scrutin: ANScrutin['scrutin']
): Record<string, { pour: number; contre: number; abstention: number; nonVotant: number }> | null {
	const ventilation = scrutin.ventilationVotes?.organe?.groupes?.groupe;
	if (!ventilation) return null;

	const groups = Array.isArray(ventilation) ? ventilation : [ventilation];
	const results: Record<
		string,
		{ pour: number; contre: number; abstention: number; nonVotant: number }
	> = {};

	for (const g of groups) {
		const decompte = g.vote.decompteVoix;
		results[g.organeRef] = {
			pour: parseInt(decompte.pour, 10) || 0,
			contre: parseInt(decompte.contre, 10) || 0,
			abstention: parseInt(decompte.abstentions, 10) || 0,
			nonVotant: parseInt(decompte.nonVotants, 10) || 0
		};
	}

	return results;
}

/**
 * Extrait les votes nominatifs d'un scrutin
 */
export function extractVotes(scrutin: ANScrutin): NewVote[] {
	const s = scrutin.scrutin;
	const ventilation = s.ventilationVotes?.organe?.groupes?.groupe;
	if (!ventilation) return [];

	const groups = Array.isArray(ventilation) ? ventilation : [ventilation];
	const votes: NewVote[] = [];

	for (const group of groups) {
		const nominatif = group.vote.decompteNominatif;
		if (!nominatif) continue;

		// Pour
		if (nominatif.pours?.votant) {
			const votants = Array.isArray(nominatif.pours.votant)
				? nominatif.pours.votant
				: [nominatif.pours.votant];
			for (const v of votants) {
				votes.push(mapVotant(s.uid, group.organeRef, v, 'pour'));
			}
		}

		// Contre
		if (nominatif.contres?.votant) {
			const votants = Array.isArray(nominatif.contres.votant)
				? nominatif.contres.votant
				: [nominatif.contres.votant];
			for (const v of votants) {
				votes.push(mapVotant(s.uid, group.organeRef, v, 'contre'));
			}
		}

		// Abstention
		if (nominatif.abstentions?.votant) {
			const votants = Array.isArray(nominatif.abstentions.votant)
				? nominatif.abstentions.votant
				: [nominatif.abstentions.votant];
			for (const v of votants) {
				votes.push(mapVotant(s.uid, group.organeRef, v, 'abstention'));
			}
		}

		// Non-votants
		if (nominatif.nonVotants?.votant) {
			const votants = Array.isArray(nominatif.nonVotants.votant)
				? nominatif.nonVotants.votant
				: [nominatif.nonVotants.votant];
			for (const v of votants) {
				votes.push(mapVotant(s.uid, group.organeRef, v, 'non-votant'));
			}
		}
	}

	return votes;
}

/**
 * Mappe un votant vers notre schéma Vote
 */
function mapVotant(
	scrutinId: string,
	groupId: string,
	votant: ANScrutinVotant,
	position: string
): NewVote {
	return {
		id: `${scrutinId}_${votant.acteurRef}`,
		scrutinId,
		actorId: votant.acteurRef,
		groupId,
		position,
		delegation: votant.parDelegation === 'true' ? 'delegation' : null,
		delegatorId: null
	};
}
