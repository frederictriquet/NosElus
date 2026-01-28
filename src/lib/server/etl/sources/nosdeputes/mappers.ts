import type { NosDeputesDepute, NosDeputesScrutin, NosDeputesVote, NosDeputesGroupe } from './api';
import type { NewActor, NewOrgan, NewScrutin, NewVote } from '../../../db';

export function mapDepute(depute: NosDeputesDepute): NewActor {
	return {
		id: `PA${depute.id_an || depute.id}`,
		uid: depute.id_an || String(depute.id),
		civility: depute.sexe === 'F' ? 'Mme' : 'M.',
		firstName: depute.prenom,
		lastName: depute.nom_de_famille,
		fullName: depute.nom,
		birthDate: depute.date_naissance || null,
		birthPlace: depute.lieu_naissance || null,
		deathDate: null,
		profession: depute.profession || null,
		photoUrl: `https://www.nosdeputes.fr/depute/photo/${depute.slug}/160`,
		chamber: 'AN'
	};
}

export function mapGroupe(groupe: NosDeputesGroupe, legislature: string = '16'): NewOrgan {
	// Convert RGB color (e.g. "255,152,0") to hex
	let color = null;
	if (groupe.couleur) {
		const rgb = groupe.couleur.split(',').map(Number);
		if (rgb.length === 3) {
			color = '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
		}
	}

	return {
		id: `PO_GP_${groupe.acronyme || groupe.slug}`,
		uid: groupe.acronyme || groupe.slug,
		type: 'GP',
		name: typeof groupe.nom === 'string' ? groupe.nom : groupe.slug,
		shortName: groupe.acronyme || null,
		color,
		chamber: 'AN',
		legislature,
		startDate: null,
		endDate: null,
		parentId: null,
		description: null
	};
}

export function mapScrutin(scrutin: NosDeputesScrutin, legislature: string = '16'): NewScrutin {
	const demandeurs = scrutin.demandeurs?.map(d => d.demandeur).join(', ') || null;

	return {
		id: `VTANR5L${legislature}-${scrutin.numero}`,
		uid: scrutin.numero,
		number: parseInt(scrutin.numero, 10),
		legislature,
		sessionOrdinary: null,
		sessionExtraordinary: null,
		date: scrutin.date,
		title: scrutin.titre,
		type: scrutin.type === 'solennel' ? 'SPS' : 'SPO',
		sortType: scrutin.sort,
		totalVoters: parseInt(scrutin.nombre_votants, 10) || 0,
		totalFor: parseInt(scrutin.nombre_pours, 10) || 0,
		totalAgainst: parseInt(scrutin.nombre_contres, 10) || 0,
		totalAbstention: parseInt(scrutin.nombre_abstentions, 10) || 0,
		totalNonVoting: 0,
		result: scrutin.sort === 'adopté' ? 'adopté' : 'rejeté',
		groupResults: null,
		lawId: null,
		amendmentRef: null,
		description: demandeurs
	};
}

export function mapVote(
	scrutinId: string,
	vote: NosDeputesVote,
	deputeSlugToId: Map<string, string>
): NewVote | null {
	const actorId = deputeSlugToId.get(vote.parlementaire_slug);
	if (!actorId) return null;

	let position: string;
	switch (vote.position) {
		case 'pour':
			position = 'pour';
			break;
		case 'contre':
			position = 'contre';
			break;
		case 'abstention':
			position = 'abstention';
			break;
		default:
			position = 'non-votant';
	}

	return {
		id: `${scrutinId}_${actorId}`,
		scrutinId,
		actorId,
		groupId: null,
		position,
		delegation: vote.par_delegation ? 'delegation' : null,
		delegatorId: null
	};
}
