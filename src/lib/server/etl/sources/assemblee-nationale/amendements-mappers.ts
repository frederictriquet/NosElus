/**
 * Mappers pour transformer les amendements AN vers le schéma de la DB
 */

import type { ANAmendement, SORT_CODES, ETAT_CODES } from './amendements-types';
import type { NewAmendment } from '../../../db';

/**
 * Détermine le statut de l'amendement à partir des données AN
 */
function determineStatus(amendement: ANAmendement['amendement']): string {
	const cycleDeVie = amendement.cycleDeVie;

	// Vérifier le sort (résultat final)
	if (cycleDeVie.sort && typeof cycleDeVie.sort === 'object' && 'code' in cycleDeVie.sort) {
		const sortCode = cycleDeVie.sort.code;
		if (sortCode) {
			switch (sortCode) {
				case 'AC': return 'adopté';
				case 'RJ': return 'rejeté';
				case 'RT': return 'retiré';
				case 'TB': return 'tombé';
				case 'AN': return 'non soutenu';
				case 'ND': return 'non défendu';
				case 'SF': return 'sans objet';
				default: return sortCode.toLowerCase();
			}
		}
	}

	// Vérifier l'état des traitements
	if (cycleDeVie.etatDesTraitements?.etat?.code) {
		const etatCode = cycleDeVie.etatDesTraitements.etat.code;
		switch (etatCode) {
			case 'AC': return 'adopté';
			case 'RJ': return 'rejeté';
			case 'RT': return 'retiré';
			case 'TB': return 'tombé';
			case 'IR': return 'irrecevable';
			case 'AN': return 'non soutenu';
			case 'ND': return 'non défendu';
			case 'SF': return 'sans objet';
			case 'DE': return 'déposé';
			case 'EN': return 'en cours';
			case 'DI': return 'discuté';
			default: return etatCode.toLowerCase();
		}
	}

	// Par défaut, considérer comme déposé
	return 'déposé';
}

/**
 * Extrait le dispositif (texte de modification) de l'amendement
 */
function extractDispositif(amendement: ANAmendement['amendement']): string | null {
	const corps = amendement.corps;
	if (!corps) return null;

	// Essayer le contenu auteur
	if (corps.contenuAuteur && typeof corps.contenuAuteur === 'object' && 'dispositif' in corps.contenuAuteur) {
		return corps.contenuAuteur.dispositif || null;
	}

	// Sinon, utiliser le cartouche informatif
	if (corps.cartoucheInformatif) {
		return corps.cartoucheInformatif;
	}

	return null;
}

/**
 * Extrait l'exposé sommaire (motifs) de l'amendement
 */
function extractExposeSommaire(amendement: ANAmendement['amendement']): string | null {
	const corps = amendement.corps;
	if (!corps) return null;

	if (corps.contenuAuteur && typeof corps.contenuAuteur === 'object' && 'exposeSommaire' in corps.contenuAuteur) {
		return corps.contenuAuteur.exposeSommaire || null;
	}

	return null;
}

/**
 * Extrait l'article visé par l'amendement
 */
function extractArticle(amendement: ANAmendement['amendement']): string | null {
	const pointeur = amendement.pointeurFragmentTexte;
	if (!pointeur?.division) return null;

	const division = pointeur.division;

	// Préférer la désignation courte
	if (division.articleDesignationCourte) {
		return division.articleDesignationCourte;
	}

	if (division.titre) {
		return division.titre;
	}

	return null;
}

/**
 * Extrait la position (avant/sur/après l'article)
 */
function extractPosition(amendement: ANAmendement['amendement']): string | null {
	const pointeur = amendement.pointeurFragmentTexte;
	if (!pointeur?.division?.avant_A_Apres) return null;

	const pos = pointeur.division.avant_A_Apres;
	switch (pos) {
		case 'A': return 'sur';
		case 'AVANT': return 'avant';
		case 'APRES': return 'après';
		default: return pos.toLowerCase();
	}
}

/**
 * Extrait la référence au texte législatif (pour lier à la table laws)
 */
function extractLawRef(amendement: ANAmendement['amendement']): string | null {
	// texteLegislatifRef contient la référence au texte (ex: PIONANR5L17B0132)
	if (amendement.texteLegislatifRef) {
		return amendement.texteLegislatifRef;
	}
	return null;
}

/**
 * Transforme un amendement AN vers le format de la DB
 */
export function mapAmendement(data: ANAmendement): NewAmendment {
	const amendement = data.amendement;

	return {
		id: amendement.uid,
		uid: amendement.uid,
		number: amendement.identification.numeroLong,
		lawId: null, // Sera lié ultérieurement si la table laws est peuplée
		authorId: amendement.signataires.auteur.acteurRef || null,
		legislature: amendement.legislature,
		article: extractArticle(amendement),
		position: extractPosition(amendement),
		status: determineStatus(amendement),
		dispositif: extractDispositif(amendement),
		exposeSommaire: extractExposeSommaire(amendement),
		depositDate: amendement.cycleDeVie.dateDepot || null,
		examDate: amendement.cycleDeVie.dateSort && typeof amendement.cycleDeVie.dateSort === 'string'
			? amendement.cycleDeVie.dateSort
			: null,
		sortOrder: amendement.identification.numeroOrdreDepot
			? parseInt(amendement.identification.numeroOrdreDepot, 10)
			: null,
		chamber: 'AN'
	};
}

/**
 * Extrait les cosignataires d'un amendement
 * Retourne un tableau de {amendementId, acteurRef}
 */
export function extractCosignataires(data: ANAmendement): Array<{ amendementId: string; actorId: string }> {
	const amendement = data.amendement;
	const cosignataires = amendement.signataires.cosignataires;

	if (!cosignataires?.acteurRef) return [];

	const acteurRefs = Array.isArray(cosignataires.acteurRef)
		? cosignataires.acteurRef
		: [cosignataires.acteurRef];

	return acteurRefs.map(actorId => ({
		amendementId: amendement.uid,
		actorId
	}));
}
