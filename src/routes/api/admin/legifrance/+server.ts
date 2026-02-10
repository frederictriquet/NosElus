/**
 * API Admin Légifrance
 *
 * Endpoints sécurisés pour la page de revue manuelle des textes de loi.
 * Nécessite une authentification admin (locals.adminAuthenticated = true).
 *
 * Actions disponibles :
 * - `?action=search` : Recherche par mots-clés avec calcul de scores Jaccard
 * - `?action=preview` : Aperçu texte complet (500 premiers caractères)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createLegifranceClient,
	type LegiSearchResult
} from '$lib/server/etl/sources/legifrance/client';
import {
	calculateSimilarity,
	extractTextFromResponse
} from '$lib/server/etl/sources/legifrance/text-matching';

/**
 * GET /api/admin/legifrance
 *
 * @param url.searchParams.action - 'search' ou 'preview'
 * @param locals.adminAuthenticated - Doit être true
 * @throws {401} Non authentifié
 * @throws {400} Action invalide ou paramètres manquants
 * @throws {503} API Légifrance non configurée
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.adminAuthenticated) {
		throw error(401, 'Non authentifie');
	}

	const action = url.searchParams.get('action');

	if (action === 'search') {
		return handleSearch(url);
	}

	if (action === 'preview') {
		return handlePreview(url);
	}

	throw error(400, 'Action invalide');
};

/**
 * Recherche par mots-clés avec calcul de scores Jaccard.
 *
 * Query params :
 * - `q` (requis) : Mots-clés de recherche
 * - `lawTitle` (optionnel) : Titre du dossier NosElus pour calcul de score
 *
 * Retourne les résultats triés par score Jaccard décroissant.
 *
 * @example
 * GET /api/admin/legifrance?action=search&q=finances+2025&lawTitle=Loi+de+finances+pour+2025
 * → { results: [{id, titre, score: 0.85}, ...], total: 42 }
 */
async function handleSearch(url: URL) {
	const query = url.searchParams.get('q');
	const lawTitle = url.searchParams.get('lawTitle') || '';

	if (!query) {
		throw error(400, 'Parametre q requis');
	}

	let client;
	try {
		client = createLegifranceClient();
	} catch {
		throw error(503, 'API Legifrance non configuree (PISTE_CLIENT_ID/SECRET manquants)');
	}

	const searchResult = await client.searchByKeyword({ query, pageSize: 20 });

	const results = searchResult.results.map((r: LegiSearchResult) => {
		const { score } = calculateSimilarity(lawTitle, r.titre);
		return {
			id: r.id,
			titre: r.titre,
			nature: r.nature,
			num: r.num,
			etat: r.etat,
			score: Math.round(score * 1000) / 1000
		};
	});

	results.sort((a, b) => b.score - a.score);

	return json({ results, total: searchResult.totalResultNumber });
}

/**
 * Aperçu d'un texte complet (500 premiers caractères).
 *
 * Query params :
 * - `textId` (requis) : ID Légifrance du texte (ex: LEGITEXT000123)
 *
 * Retourne un aperçu du texte pour validation visuelle avant association.
 *
 * @example
 * GET /api/admin/legifrance?action=preview&textId=LEGITEXT000123
 * → { textId, title, preview: "Article 1er...", totalLength: 12345 }
 */
async function handlePreview(url: URL) {
	const textId = url.searchParams.get('textId');

	if (!textId) {
		throw error(400, 'Parametre textId requis');
	}

	let client;
	try {
		client = createLegifranceClient();
	} catch {
		throw error(503, 'API Legifrance non configuree');
	}

	const texte = await client.getTexteComplet(textId);
	const fullText = extractTextFromResponse(texte);

	return json({
		textId,
		title: texte.title || '',
		preview: fullText.slice(0, 500),
		totalLength: fullText.length
	});
}
