// Types pour les scrutins de l'Assemblée Nationale

export interface ANScrutin {
	scrutin: {
		uid: string;
		numero: string;
		organeRef: string;
		legislature: string;
		sessionRef?: string;
		seanceRef?: string;
		dateScrutin: string;
		quantiemeJourSeance?: string;
		typeVote: {
			codeTypeVote: string;
			libelleTypeVote: string;
			typeMajorite?: string;
		};
		sort: {
			code: string;
			libelle: string;
		};
		titre: string;
		demandeur?: {
			texte?: string | null;
			referenceLegislative?: string | null;
		};
		objet?: {
			libelle?: string;
			dossierLegislatif?: string | null;
			referenceLegislative?: string | null;
		};
		modePublicationDesVotes: string;
		syntheseVote: {
			nombreVotants: string;
			suffragesExprimes: string;
			nbrSuffragesRequis: string;
			annonce: string;
			decompte: {
				nonVotants: string;
				pour: string;
				contre: string;
				abstentions: string;
				nonVotantsVolontaires?: string;
			};
		};
		ventilationVotes?: {
			organe: {
				organeRef: string;
				groupes: {
					groupe: ANScrutinGroupe | ANScrutinGroupe[];
				};
			};
		};
	};
}

export interface ANScrutinGroupe {
	organeRef: string;
	nombreMembresGroupe: string;
	vote: {
		positionMajoritaire: string;
		decompteVoix: {
			nonVotants: string;
			pour: string;
			contre: string;
			abstentions: string;
			nonVotantsVolontaires?: string;
		};
		decompteNominatif?: {
			nonVotants?: ANScrutinVotants | null;
			pours?: ANScrutinVotants | null;
			contres?: ANScrutinVotants | null;
			abstentions?: ANScrutinVotants | null;
		};
	};
}

export interface ANScrutinVotants {
	votant: ANScrutinVotant | ANScrutinVotant[];
}

export interface ANScrutinVotant {
	acteurRef: string;
	mandatRef: string;
	parDelegation: string;
	numPlace?: string;
	causePositionVote?: string;
}
