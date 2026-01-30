// Types pour les données de l'Assemblée Nationale (data.assemblee-nationale.fr)

export interface ANActeur {
	acteur: {
		uid: { '#text': string };
		etatCivil: {
			ident: {
				civ: string;
				prenom: string;
				nom: string;
				alpha: string;
			};
			infoNaissance: {
				dateNais: string;
				villeNais?: string;
				depNais?: string;
				paysNais?: string;
			};
			dateDeces?: { '#text'?: string; '@xsi:nil'?: string } | null;
		};
		profession?: {
			libelleCourant?: string;
		};
		mandats: {
			mandat: ANMandat | ANMandat[];
		};
	};
}

export interface ANMandat {
	'@xsi:type': string;
	uid: string;
	acteurRef: string;
	legislature: string | null;
	typeOrgane: string;
	dateDebut: string;
	dateFin: string | null;
	preseance?: string;
	nominPrincipale?: string;
	infosQualite?: {
		codeQualite?: string;
		libQualite?: string;
		libQualiteSex?: string;
	};
	organes?: {
		organeRef: string;
	};
	election?: {
		causeMandat?: string;
		refCirconscription?: string;
		lieu?: {
			region?: string;
			regionType?: string;
			departement?: string;
			numDepartement?: string;
			numCirco?: string;
		};
	};
	mandature?: {
		datePriseFonction?: string;
		causeFin?: string;
		premiereElection?: string;
		placeHemicycle?: string;
	};
	suppleant?: {
		suppleantRef?: string;
		dateDebut?: string;
		dateFin?: string | null;
	};
}

export interface ANOrgane {
	organe: {
		'@xsi:type'?: string;
		uid: string;
		codeType: string;
		libelle: string;
		libelleEdition?: string;
		libelleAbrege?: string;
		libelleAbrev?: string;
		viMoDe: {
			dateDebut: string;
			dateAgrement?: string | null;
			dateFin: string | null;
		};
		organeParent?: string | null;
		chambre?: string | null;
		regime?: string;
		legislature?: string;
		positionPolitique?: string;
		preseance?: string;
		couleurAssociee?: string;
	};
}

// Types pour les mandats parlementaires filtrés
export interface ANMandatAssemblee extends ANMandat {
	typeOrgane: 'ASSEMBLEE';
	legislature: string;
	election: {
		causeMandat: string;
		lieu: {
			departement: string;
			numDepartement: string;
			numCirco: string;
		};
	};
}

export interface ANMandatGroupe extends ANMandat {
	typeOrgane: 'GP';
	legislature: string;
	organes: {
		organeRef: string;
	};
}
