/**
 * Types pour les amendements de l'Assemblée Nationale
 * Source: data.assemblee-nationale.fr
 */

export interface ANAmendement {
	amendement: {
		uid: string;
		chronotag?: string;
		legislature: string;
		identification: {
			numeroLong: string;
			numeroOrdreDepot: string;
			prefixeOrganeExamen?: string;
			numeroRect?: string;
		};
		examenRef?: string;
		texteLegislatifRef?: string;
		triAmendement?: string;
		cardinaliteAmdtMultiples?: string;
		amendementParentRef?: ANNullableRef;
		signataires: {
			auteur: {
				typeAuteur: string;
				gouvernementRef?: ANNullableRef;
				acteurRef?: string;
				groupePolitiqueRef?: string;
				auteurRapporteurOrganeRef?: ANNullableRef;
			};
			cosignataires?: {
				acteurRef?: string | string[];
			};
			suffixe?: ANNullableRef;
			libelle?: string;
		};
		pointeurFragmentTexte?: {
			partieAmendableRef?: ANNullableRef;
			division?: {
				titre?: string;
				articleDesignationCourte?: string;
				articleDesignation?: string;
				type?: string;
				avant_A_Apres?: string; // 'A' = sur l'article, 'AVANT' = avant, 'APRES' = après
				divisionRattachee?: ANNullableRef;
				articleAdditionnel?: string;
				chapitreAdditionnel?: string;
				urlDivisionTexteVise?: string;
			};
			amendementStandard?: {
				alinea?: ANNullableRef | { numero?: string };
			};
		};
		corps?: {
			cartoucheInformatif?: string;
			contenuAuteur?: ANNullableRef | {
				dispositif?: string;
				exposeSommaire?: string;
			};
		};
		cycleDeVie: {
			dateDepot?: string;
			datePublication?: string;
			soumisArticle40?: string;
			etatDesTraitements?: {
				etat?: {
					code?: string;
					libelle?: string;
				};
				sousEtat?: {
					code?: string;
					libelle?: string;
				};
			};
			dateSort?: ANNullableRef | string;
			sort?: ANNullableRef | {
				code?: string;
				libelle?: string;
			};
		};
		representations?: {
			representation?: ANRepresentation | ANRepresentation[];
		};
		seanceDiscussionRef?: ANNullableRef | string;
		article99?: string;
		loiReference?: ANNullableRef | {
			numeroLoi?: string;
		};
		discussionCommune?: ANNullableRef | {
			idDiscussionCommune?: string;
		};
		discussionIdentique?: ANNullableRef | {
			idDiscussionIdentique?: string;
		};
		accordGouvernementDepotHorsDelai?: string;
	};
}

interface ANNullableRef {
	'@xmlns:xsi'?: string;
	'@xsi:nil'?: string;
}

interface ANRepresentation {
	nom?: string;
	typeMime?: {
		type?: string;
		subType?: string;
	};
	statutRepresentation?: {
		verbatim?: string;
		canonique?: string;
		officielle?: string;
		transcription?: string;
		enregistrement?: string;
	};
	repSource?: ANNullableRef;
	offset?: ANNullableRef;
	contenu?: {
		documentURI?: string;
	};
	dateDispoRepresentation?: ANNullableRef | string;
}

/**
 * Mapping des codes de sort vers les statuts
 */
export const SORT_CODES: Record<string, string> = {
	'AC': 'adopté',
	'RJ': 'rejeté',
	'RT': 'retiré',
	'TB': 'tombé',
	'AN': 'non soutenu',
	'IR': 'irrecevable',
	'ND': 'non défendu',
	'SF': 'sans objet',
	'IS': 'irrecevable 40', // Irrecevable article 40 Constitution
};

/**
 * Mapping des codes d'état vers les statuts
 */
export const ETAT_CODES: Record<string, string> = {
	'AC': 'adopté',
	'RJ': 'rejeté',
	'RT': 'retiré',
	'TB': 'tombé',
	'AN': 'non soutenu',
	'IR': 'irrecevable',
	'ND': 'non défendu',
	'SF': 'sans objet',
	'DE': 'déposé',
	'EN': 'en cours',
	'DI': 'discuté',
};
