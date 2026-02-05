import type { ANActeur, ANOrgane, ANMandat } from './types';
import type { NewActor, NewOrgan, NewMandate } from '../../../db';

// Mapping des législatures vers l'ID de l'organe Assemblée
const ASSEMBLEE_ORGAN_IDS: Record<string, string> = {
	'11': 'PO230433', // Pas de données exactes pour la 11e
	'12': 'PO230434',
	'13': 'PO384266',
	'14': 'PO644420',
	'15': 'PO717460',
	'16': 'PO791932',
	'17': 'PO838901'
};

/**
 * Mappe un acteur AN vers notre schéma Actor
 */
export function mapActeur(acteur: ANActeur): NewActor {
	const { etatCivil, profession, uid } = acteur.acteur;
	const acteurId = typeof uid === 'object' ? uid['#text'] : uid;

	// Handle death date
	let deathDate: string | null = null;
	if (etatCivil.dateDeces && typeof etatCivil.dateDeces === 'object') {
		if (etatCivil.dateDeces['#text']) {
			deathDate = etatCivil.dateDeces['#text'];
		}
	}

	return {
		id: acteurId,
		uid: acteurId,
		civility: etatCivil.ident.civ || null,
		firstName: etatCivil.ident.prenom,
		lastName: etatCivil.ident.nom,
		fullName: `${etatCivil.ident.prenom} ${etatCivil.ident.nom}`,
		birthDate: etatCivil.infoNaissance?.dateNais || null,
		birthPlace: etatCivil.infoNaissance?.villeNais || null,
		deathDate,
		profession: profession?.libelleCourant || null,
		photoUrl: `https://www.assemblee-nationale.fr/dyn/deputes/${acteurId}_photo`,
		chamber: 'AN'
	};
}

/**
 * Mappe un organe AN vers notre schéma Organ
 */
export function mapOrgane(organe: ANOrgane): NewOrgan {
	const { uid, codeType, libelle, libelleAbrege, viMoDe, legislature, couleurAssociee, chambre } =
		organe.organe;

	return {
		id: uid,
		uid: uid,
		type: codeType,
		name: libelle,
		shortName: libelleAbrege || null,
		color: couleurAssociee || null,
		chamber: chambre || 'AN',
		legislature: legislature || null,
		startDate: viMoDe?.dateDebut || null,
		endDate: viMoDe?.dateFin || null,
		parentId: null,
		description: null
	};
}

/**
 * Extrait tous les mandats d'un acteur et les mappe vers notre schéma
 */
export function mapActeurMandats(acteur: ANActeur): NewMandate[] {
	const mandats = acteur.acteur.mandats.mandat;
	const mandatList = Array.isArray(mandats) ? mandats : [mandats];
	const acteurId =
		typeof acteur.acteur.uid === 'object' ? acteur.acteur.uid['#text'] : acteur.acteur.uid;

	const result: NewMandate[] = [];

	for (const mandat of mandatList) {
		// On ne garde que les mandats AN (député) et GP (groupe parlementaire)
		if (mandat.typeOrgane === 'ASSEMBLEE') {
			result.push(mapMandatAssemblee(acteurId, mandat));
		} else if (mandat.typeOrgane === 'GP') {
			result.push(mapMandatGroupe(acteurId, mandat));
		}
	}

	return result;
}

/**
 * Mappe un mandat de député (ASSEMBLEE)
 */
function mapMandatAssemblee(acteurId: string, mandat: ANMandat): NewMandate {
	const election = mandat.election;
	const lieu = election?.lieu;
	const legislature = mandat.legislature || '17';
	const organId = ASSEMBLEE_ORGAN_IDS[legislature] || ASSEMBLEE_ORGAN_IDS['17'];

	return {
		id: mandat.uid,
		actorId: acteurId,
		organId,
		type: 'depute',
		quality: mandat.infosQualite?.libQualite || null,
		startDate: mandat.dateDebut,
		endDate: mandat.dateFin || null,
		legislature,
		department: lieu?.departement || null,
		departmentCode: lieu?.numDepartement || null,
		constituency: lieu?.departement || null,
		constituencyNumber: lieu?.numCirco || null,
		electionCause: election?.causeMandat || null,
		mandateEndCause: mandat.mandature?.causeFin || null
	};
}

/**
 * Mappe un mandat de groupe parlementaire (GP)
 */
function mapMandatGroupe(acteurId: string, mandat: ANMandat): NewMandate {
	const organId = mandat.organes?.organeRef;
	if (!organId) {
		throw new Error(`No organeRef for GP mandate ${mandat.uid}`);
	}

	return {
		id: mandat.uid,
		actorId: acteurId,
		organId: organId,
		type: 'membre',
		quality: mandat.infosQualite?.libQualite || null,
		startDate: mandat.dateDebut,
		endDate: mandat.dateFin || null,
		legislature: mandat.legislature || null,
		department: null,
		departmentCode: null,
		constituency: null,
		constituencyNumber: null,
		electionCause: null,
		mandateEndCause: null
	};
}

/**
 * Récupère les législatures d'un acteur à partir de ses mandats AN
 */
export function getActeurLegislatures(acteur: ANActeur): string[] {
	const mandats = acteur.acteur.mandats.mandat;
	const mandatList = Array.isArray(mandats) ? mandats : [mandats];

	const legislatures = new Set<string>();
	for (const mandat of mandatList) {
		if (mandat.typeOrgane === 'ASSEMBLEE' && mandat.legislature) {
			legislatures.add(mandat.legislature);
		}
	}

	return Array.from(legislatures).sort();
}
