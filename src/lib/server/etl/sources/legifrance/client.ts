/**
 * Client API Légifrance via PISTE
 *
 * Documentation: https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api
 * Portail PISTE: https://piste.gouv.fr
 *
 * Authentification: OAuth 2.0 Client Credentials Flow
 */

export interface PisteConfig {
	clientId: string;
	clientSecret: string;
	environment: 'sandbox' | 'production';
}

interface OAuthToken {
	access_token: string;
	token_type: string;
	expires_in: number;
	scope: string;
}

interface CachedToken {
	token: string;
	expiresAt: number;
}

/**
 * URLs selon l'environnement PISTE
 */
const PISTE_URLS = {
	sandbox: {
		oauth: 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token',
		api: 'https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app'
	},
	production: {
		oauth: 'https://oauth.piste.gouv.fr/api/oauth/token',
		api: 'https://api.piste.gouv.fr/dila/legifrance/lf-engine-app'
	}
};

/**
 * Client pour l'API Légifrance via PISTE
 */
export class LegifranceClient {
	private config: PisteConfig;
	private cachedToken: CachedToken | null = null;
	private urls: typeof PISTE_URLS.sandbox;

	constructor(config: PisteConfig) {
		this.config = config;
		this.urls = PISTE_URLS[config.environment];
	}

	/**
	 * Obtient un token OAuth 2.0 (avec cache)
	 */
	private async getAccessToken(): Promise<string> {
		// Vérifier le cache (avec marge de 60s)
		if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
			return this.cachedToken.token;
		}

		const response = await fetch(this.urls.oauth, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				grant_type: 'client_credentials',
				client_id: this.config.clientId,
				client_secret: this.config.clientSecret,
				scope: 'openid'
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OAuth error ${response.status}: ${errorText}`);
		}

		const data = (await response.json()) as OAuthToken;

		// Cache le token
		this.cachedToken = {
			token: data.access_token,
			expiresAt: Date.now() + data.expires_in * 1000
		};

		return data.access_token;
	}

	/**
	 * Effectue une requête authentifiée à l'API
	 */
	private async request<T>(endpoint: string, body: object): Promise<T> {
		const token = await this.getAccessToken();

		const response = await fetch(`${this.urls.api}${endpoint}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API error ${response.status}: ${errorText}`);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * Recherche des textes de loi par critères
	 * Note: La recherche par numéro n'est pas supportée directement par l'API,
	 * on filtre côté client après récupération des résultats
	 */
	async searchLois(params: {
		nature?: string; // LOI, ORDONNANCE, DECRET, etc.
		pageNumber?: number;
		pageSize?: number;
	}): Promise<LegiSearchResponse> {
		const { nature = 'LOI', pageNumber = 1, pageSize = 10 } = params;

		// Format correct pour l'API PISTE (utilise facette, pas field)
		const filtres: SearchFacetFilter[] = [{ facette: 'NATURE', valeurs: [nature] }];

		const response = await this.request<PisteSearchResponse>('/search', {
			fond: 'LODA_ETAT',
			recherche: {
				filtres,
				pageNumber,
				pageSize,
				operateur: 'ET',
				typePagination: 'DEFAUT',
				sort: 'SIGNATURE_DATE_DESC',
				fromAdvancedRecherche: false
			}
		});

		// Transformer la réponse PISTE vers notre format
		return {
			totalResultNumber: response.totalResultNumber,
			results: response.results.map((r) => ({
				id: r.titles?.[0]?.id?.split('_')[0] || '', // Extraire l'ID sans la date
				cid: r.titles?.[0]?.cid || '',
				nor: r.nor,
				num: r.num,
				titre: r.titles?.[0]?.title || '',
				nature: r.nature,
				etat: r.titles?.[0]?.legalStatus
			}))
		};
	}

	/**
	 * Récupère le texte complet d'une loi par son identifiant LEGI.
	 * Fallback sur /consult/jorf si legiPart échoue et qu'un CID est fourni.
	 * @param textId - Identifiant du texte (ex: LEGITEXT000053145205)
	 * @param options.date - Date de version (format YYYY-MM-DD), défaut: aujourd'hui
	 * @param options.cid - CID JORF pour fallback (ex: JORFTEXT000038821374)
	 */
	async getTexteComplet(
		textId: string,
		options?: { date?: string; cid?: string }
	): Promise<LegiTexteResponse> {
		const consultDate = options?.date || new Date().toISOString().split('T')[0];
		try {
			return await this.request<LegiTexteResponse>('/consult/legiPart', {
				textId,
				date: consultDate
			});
		} catch (error) {
			// Fallback sur /consult/jorf si legiPart échoue (certaines lois n'ont pas de version LEGI consolidée)
			if (options?.cid && error instanceof Error && error.message.includes('400')) {
				return this.request<LegiTexteResponse>('/consult/jorf', {
					textCid: options.cid
				});
			}
			throw error;
		}
	}

	/**
	 * Récupère un texte par son numéro (ex: "2024-120" pour LOI n° 2024-120)
	 * Parcourt les résultats de recherche pour trouver le bon numéro
	 */
	async getLoiByNumero(numero: string): Promise<LegiTexteResponse | null> {
		try {
			// Chercher dans les lois récentes (par page de 100)
			let pageNumber = 1;
			const maxPages = 50; // Limite de sécurité

			while (pageNumber <= maxPages) {
				const searchResult = await this.searchLois({
					nature: 'LOI',
					pageSize: 100,
					pageNumber
				});

				if (!searchResult.results || searchResult.results.length === 0) {
					return null;
				}

				// Chercher le numéro dans les résultats
				const match = searchResult.results.find((r) => r.num === numero);
				if (match) {
					return this.getTexteComplet(match.id, { cid: match.cid });
				}

				// Si on a parcouru tous les résultats
				if (searchResult.results.length < 100) {
					return null;
				}

				pageNumber++;
			}

			return null;
		} catch (error) {
			console.error(`Erreur recherche loi ${numero}:`, error);
			return null;
		}
	}

	/**
	 * Recherche de textes de loi par mots-clés dans le titre.
	 *
	 * Utilise l'endpoint `/search` avec :
	 * - Champ de recherche : `TITLE` (titre des lois)
	 * - Filtre : `NATURE = LOI`
	 * - Tri : `PERTINENCE` (résultats les plus pertinents en premier)
	 *
	 * **Use case** : Recherche manuelle d'un texte Légifrance depuis l'UI admin
	 * lorsque le matching automatique par similarité Jaccard a échoué.
	 *
	 * @param params - Paramètres de recherche
	 * @param params.query - Mots-clés de recherche (recherche dans le titre)
	 * @param params.pageNumber - Numéro de page (défaut: 1)
	 * @param params.pageSize - Nombre de résultats par page (défaut: 20, max: 100)
	 * @returns Résultats de recherche avec textIds, titres et métadonnées
	 *
	 * @example
	 * ```typescript
	 * const client = createLegifranceClient();
	 * const results = await client.searchByKeyword({
	 *   query: 'finances agriculture 2025',
	 *   pageSize: 10
	 * });
	 *
	 * console.log(`${results.totalResultNumber} lois trouvées`);
	 * results.results.forEach(r => {
	 *   console.log(`${r.titre} (${r.id})`);
	 * });
	 * ```
	 *
	 * @throws {Error} Erreur OAuth ou API Légifrance
	 */
	async searchByKeyword(params: {
		query: string;
		pageNumber?: number;
		pageSize?: number;
	}): Promise<LegiSearchResponse> {
		const { query, pageNumber = 1, pageSize = 20 } = params;

		const response = await this.request<PisteSearchResponse>('/search', {
			fond: 'LODA_ETAT',
			recherche: {
				champs: [
					{
						typeChamp: 'TITLE',
						criteres: [
							{
								typeRecherche: 'EXACTE',
								valeur: query,
								operateur: 'ET'
							}
						]
					}
				],
				filtres: [{ facette: 'NATURE', valeurs: ['LOI'] }],
				pageNumber,
				pageSize,
				operateur: 'ET',
				typePagination: 'DEFAUT',
				sort: 'PERTINENCE',
				fromAdvancedRecherche: false
			}
		});

		return {
			totalResultNumber: response.totalResultNumber,
			results: response.results.map((r) => ({
				id: r.titles?.[0]?.id?.split('_')[0] || '',
				cid: r.titles?.[0]?.cid || '',
				nor: r.nor,
				num: r.num,
				titre: r.titles?.[0]?.title || '',
				nature: r.nature,
				etat: r.titles?.[0]?.legalStatus
			}))
		};
	}

	/**
	 * Test de connexion à l'API
	 */
	async testConnection(): Promise<boolean> {
		try {
			await this.getAccessToken();
			console.log('✓ Connexion OAuth réussie');

			// Test une recherche simple
			const result = await this.searchLois({ pageSize: 1 });
			console.log(`✓ Recherche fonctionnelle (${result.totalResultNumber} lois disponibles)`);

			// Test récupération d'un texte complet si on a des résultats
			if (result.results.length > 0) {
				const first = result.results[0];
				const texte = await this.getTexteComplet(first.id, { cid: first.cid });
				console.log(`✓ Consultation fonctionnelle (texte: ${texte.title?.slice(0, 50)}...)`);
			}

			return true;
		} catch (error) {
			console.error('✗ Erreur de connexion:', error);
			return false;
		}
	}
}

// ============================================================
// Types de réponse API
// ============================================================

/**
 * Filtre de recherche au format PISTE (utilise facette)
 */
interface SearchFacetFilter {
	facette: string;
	valeurs?: string[];
	dates?: {
		start?: string;
		end?: string;
	};
}

/**
 * Réponse brute de l'API PISTE /search
 */
interface PisteSearchResponse {
	totalResultNumber: number;
	results: PisteSearchResult[];
}

interface PisteSearchResult {
	titles?: Array<{
		id: string;
		cid: string;
		title: string;
		legalStatus?: string;
	}>;
	num?: string;
	nor?: string;
	nature: string;
}

export interface LegiSearchResponse {
	totalResultNumber: number;
	results: LegiSearchResult[];
}

export interface LegiSearchResult {
	id: string; // Ex: LEGITEXT000048884413
	cid: string;
	nor?: string;
	num?: string;
	titre: string;
	titreLong?: string;
	nature: string; // LOI, ORDONNANCE, etc.
	dateSignature?: string;
	datePubli?: string;
	etat?: string; // VIGUEUR, ABROGE, etc.
}

export interface LegiTexteResponse {
	id: string;
	cid: string;
	nor?: string;
	title?: string;
	nature?: string;
	jurisState?: string; // VIGUEUR, ABROGE, etc.
	jurisDate?: string;
	modifDate?: string;
	visa?: string;
	signers?: string;
	// Structure du texte
	articles?: LegiArticle[];
	sections?: LegiSection[];
	// Exposé des motifs (si disponible)
	exposesMotifs?: string;
}

export interface LegiArticle {
	id: string;
	num?: string; // "1", "2", "L. 121-1", etc.
	etat?: string;
	content?: string; // HTML du contenu
	texteHtml?: string; // Alternative pour le contenu HTML
	nota?: string;
}

export interface LegiSection {
	id: string;
	titre?: string;
	articles?: LegiArticle[];
	sections?: LegiSection[]; // Récursif
}

// ============================================================
// Factory function
// ============================================================

/**
 * Crée un client Légifrance depuis les variables d'environnement
 */
export function createLegifranceClient(): LegifranceClient {
	const clientId = process.env.PISTE_CLIENT_ID;
	const clientSecret = process.env.PISTE_CLIENT_SECRET;
	const env = (process.env.PISTE_ENV || 'sandbox') as 'sandbox' | 'production';

	if (!clientId || !clientSecret) {
		throw new Error(
			'PISTE_CLIENT_ID et PISTE_CLIENT_SECRET requis. Voir .env.example pour la configuration.'
		);
	}

	return new LegifranceClient({
		clientId,
		clientSecret,
		environment: env
	});
}
