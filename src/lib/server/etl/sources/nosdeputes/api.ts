const BASE_URL = 'https://www.nosdeputes.fr';

export interface NosDeputesDepute {
	id: number;
	nom: string;
	nom_de_famille: string;
	prenom: string;
	sexe: string;
	date_naissance: string;
	lieu_naissance: string;
	num_deptmt: string;
	nom_circo: string;
	num_circo: number;
	mandat_debut: string;
	mandat_fin?: string;
	ancien_depute: number;
	groupe_sigle: string;
	parti_ratt_financier: string;
	sites_web: Array<{ site: string }>;
	emails: Array<{ email: string }>;
	profession: string;
	place_en_hemicycle: string;
	url_an: string;
	id_an: string;
	slug: string;
	url_nosdeputes: string;
	url_nosdeputes_api: string;
	nb_mandats: number;
	twitter: string;
}

export interface NosDeputesScrutin {
	numero: string;
	date: string;
	type: string;
	sort: string;
	titre: string;
	nombre_votants: string;
	nombre_pours: string;
	nombre_contres: string;
	nombre_abstentions: string;
	demandeurs: Array<{ demandeur: string }>;
	url_institution: string;
}

export interface NosDeputesVote {
	parlementaire_slug: string;
	position: string;
	position_groupe: string;
	par_delegation: boolean;
	mise_au_point_position: string;
}

async function fetchJson<T>(url: string): Promise<T> {
	console.log(`Fetching: ${url}`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return response.json();
}

export async function fetchDeputes(legislature?: string): Promise<NosDeputesDepute[]> {
	// For legislature 16/17, use main domain without legislature in path
	// For older legislatures, use subdomain (e.g., 2017-2022.nosdeputes.fr)
	const baseUrl = legislature && !['16', '17'].includes(legislature)
		? `https://${legislature}.nosdeputes.fr`
		: BASE_URL;

	const data = await fetchJson<{ deputes: Array<{ depute: NosDeputesDepute }> }>(
		`${baseUrl}/deputes/json`
	);
	return data.deputes?.map((d) => d.depute) ?? [];
}

export async function fetchDeputesEnMandat(): Promise<NosDeputesDepute[]> {
	const data = await fetchJson<{ deputes: Array<{ depute: NosDeputesDepute }> }>(
		`${BASE_URL}/deputes/enmandat/json`
	);
	return data.deputes.map((d) => d.depute);
}

export async function fetchScrutins(legislature: string = '16'): Promise<NosDeputesScrutin[]> {
	const baseUrl = legislature !== '16' && legislature !== '17'
		? `https://${legislature}.nosdeputes.fr`
		: BASE_URL;

	// For recent legislatures, the path includes the legislature number
	const path = legislature === '16' || legislature === '17'
		? `/${legislature}/scrutins/json`
		: `/scrutins/json`;

	const data = await fetchJson<{ scrutins?: Array<{ scrutin: NosDeputesScrutin }> }>(
		`${baseUrl}${path}`
	);
	return data.scrutins?.map((s) => s.scrutin) ?? [];
}

export async function fetchScrutinVotes(
	scrutinId: number,
	legislature: string = '16'
): Promise<NosDeputesVote[]> {
	const baseUrl = legislature !== '16' && legislature !== '17'
		? `https://${legislature}.nosdeputes.fr`
		: BASE_URL;

	// For recent legislatures, the path includes the legislature number
	const path = legislature === '16' || legislature === '17'
		? `/${legislature}/scrutin/${scrutinId}/json`
		: `/scrutin/${scrutinId}/json`;

	const data = await fetchJson<{ votes?: Array<{ vote: NosDeputesVote }> }>(
		`${baseUrl}${path}`
	);

	if (!data.votes) return [];
	return data.votes.map((v) => v.vote);
}

export interface NosDeputesGroupe {
	id: number;
	slug: string;
	nom: string | false;
	acronyme: string;
	groupe_actuel: boolean;
	couleur: string;
	order: number | string;
	type: string;
}

export async function fetchGroupes(legislature?: string): Promise<NosDeputesGroupe[]> {
	// For legislature 16/17, use main domain without legislature in path
	// For older legislatures, use subdomain (e.g., 2017-2022.nosdeputes.fr)
	const baseUrl = legislature && !['16', '17'].includes(legislature)
		? `https://${legislature}.nosdeputes.fr`
		: BASE_URL;

	const data = await fetchJson<{ organismes?: Array<{ organisme: NosDeputesGroupe }> }>(
		`${baseUrl}/organismes/groupe/json`
	);

	// Include all groups (current and historical) that have a valid name
	// Don't filter by groupe_actuel to get historical groups with their colors
	return (data.organismes ?? [])
		.map((o) => o.organisme)
		.filter((o) => o.type === 'groupe' && o.nom !== false);
}
