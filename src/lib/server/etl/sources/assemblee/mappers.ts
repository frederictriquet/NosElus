import type { Acteur, Organe, Mandat } from '@tricoteuses/assemblee';
import type { Scrutin, Votant, VentilationVotesGroupe } from '@tricoteuses/assemblee';
import type { NewActor, NewOrgan, NewMandate, NewScrutin, NewVote } from '../../../db';
import { formatDate } from '../../utils';
import { classifyScrutin } from '../../classify';

// === ACTORS ===

export function mapActeur(acteur: Acteur): NewActor {
	const { etatCivil, profession, photo } = acteur;
	const { ident, infoNaissance } = etatCivil;

	return {
		id: acteur.uid,
		uid: acteur.uid,
		civility: ident.civ || null,
		firstName: ident.prenom,
		lastName: ident.nom,
		fullName: `${ident.prenom} ${ident.nom}`,
		birthDate: formatDate(infoNaissance?.dateNais),
		birthPlace: infoNaissance?.villeNais
			? `${infoNaissance.villeNais}${infoNaissance.depNais ? `, ${infoNaissance.depNais}` : ''}`
			: null,
		deathDate: formatDate(etatCivil.dateDeces),
		profession: profession?.libelleCourant || null,
		photoUrl: photo?.chemin ? `https://www.assemblee-nationale.fr${photo.chemin}` : null,
		chamber: 'AN' // Always AN for this source
	};
}

// === ORGANS ===

export function mapOrgane(organe: Organe): NewOrgan {
	return {
		id: organe.uid,
		uid: organe.uid,
		type: organe.codeType,
		name: organe.libelle,
		shortName: organe.libelleAbrege || organe.libelleAbrev || null,
		color: organe.couleurAssociee || null,
		chamber: 'AN',
		legislature: organe.legislature || null,
		startDate: formatDate(organe.viMoDe?.dateDebut),
		endDate: formatDate(organe.viMoDe?.dateFin),
		parentId: organe.organeParentRef || null,
		description: null
	};
}

// === MANDATES ===

export function mapMandat(mandat: Mandat, acteurUid: string): NewMandate | null {
	// We need at least one organ reference
	const organRef = mandat.organesRefs?.[0];
	if (!organRef) return null;

	return {
		id: mandat.uid,
		actorId: acteurUid,
		organId: organRef,
		type: mandat.infosQualite?.codeQualite || 'membre',
		quality: mandat.infosQualite?.libQualiteSex || mandat.infosQualite?.libQualite || null,
		startDate: formatDate(mandat.dateDebut) || new Date().toISOString().split('T')[0],
		endDate: formatDate(mandat.dateFin),
		legislature: mandat.legislature || null,
		department: mandat.election?.lieu?.departement || null,
		departmentCode: mandat.election?.lieu?.numDepartement || null,
		constituency: mandat.election?.lieu?.numCirco
			? `Circonscription ${mandat.election.lieu.numCirco}`
			: null,
		constituencyNumber: mandat.election?.lieu?.numCirco || null,
		electionCause: mandat.election?.causeMandat || null,
		mandateEndCause: mandat.mandature?.causeFin || null
	};
}

// === SCRUTINS ===

export function mapScrutin(scrutin: Scrutin): NewScrutin {
	const synthesis = scrutin.syntheseVote;
	const decompte = synthesis.decompte;

	return {
		id: scrutin.uid,
		uid: scrutin.uid,
		number: parseInt(scrutin.numero, 10),
		legislature: scrutin.legislature,
		sessionOrdinary: scrutin.sessionRef || null,
		sessionExtraordinary: null,
		date: formatDate(scrutin.dateScrutin) || new Date().toISOString().split('T')[0],
		title: scrutin.titre,
		type: scrutin.typeVote.codeTypeVote,
		sortType: scrutin.sort.code,
		category: classifyScrutin(scrutin.titre),
		totalVoters: parseInt(synthesis.nombreVotants, 10) || 0,
		totalFor: parseInt(decompte.pour, 10) || 0,
		totalAgainst: parseInt(decompte.contre, 10) || 0,
		totalAbstention: parseInt(decompte.abstentions || '0', 10),
		totalNonVoting: parseInt(decompte.nonVotants || '0', 10),
		result: scrutin.sort.code === 'adopté' ? 'adopté' : 'rejeté',
		groupResults: mapGroupResults(scrutin.ventilationVotes?.groupes),
		lawId: null,
		amendmentRef: null,
		description: scrutin.objet?.libelle || null
	};
}

function mapGroupResults(
	groupes: VentilationVotesGroupe[] | undefined
): Record<string, unknown> | null {
	if (!groupes) return null;

	const results: Record<string, unknown> = {};
	for (const groupe of groupes) {
		results[groupe.organeRef] = {
			members: parseInt(groupe.nombreMembresGroupe, 10),
			position: groupe.vote.positionMajoritaire,
			for: parseInt(groupe.vote.decompteVoix.pour, 10) || 0,
			against: parseInt(groupe.vote.decompteVoix.contre, 10) || 0,
			abstention: parseInt(groupe.vote.decompteVoix.abstentions || '0', 10),
			nonVoting: parseInt(groupe.vote.decompteVoix.nonVotants || '0', 10)
		};
	}
	return results;
}

// === VOTES ===

export function mapVotesFromScrutin(scrutin: Scrutin): NewVote[] {
	const votes: NewVote[] = [];
	const groupes = scrutin.ventilationVotes?.groupes || [];

	for (const groupe of groupes) {
		const decompte = groupe.vote.decompteNominatif;
		const groupId = groupe.organeRef;

		// Pour
		if (decompte.pour) {
			for (const votant of decompte.pour) {
				votes.push(mapVotant(scrutin.uid, votant, groupId, 'pour'));
			}
		}

		// Contre
		if (decompte.contre) {
			for (const votant of decompte.contre) {
				votes.push(mapVotant(scrutin.uid, votant, groupId, 'contre'));
			}
		}

		// Abstention
		if (decompte.abstentions) {
			for (const votant of decompte.abstentions) {
				votes.push(mapVotant(scrutin.uid, votant, groupId, 'abstention'));
			}
		}

		// Non votants
		if (decompte.nonVotants) {
			for (const votant of decompte.nonVotants) {
				votes.push(mapVotant(scrutin.uid, votant, groupId, 'non-votant'));
			}
		}
	}

	return votes;
}

function mapVotant(
	scrutinId: string,
	votant: Votant,
	groupId: string,
	position: string
): NewVote {
	return {
		id: `${scrutinId}_${votant.acteurRef}`,
		scrutinId,
		actorId: votant.acteurRef,
		groupId,
		position,
		delegation: votant.parDelegation ? 'delegation' : null,
		delegatorId: null // Not available in the data
	};
}
