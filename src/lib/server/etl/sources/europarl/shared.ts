/**
 * Fonctions partagées entre les modules ETL EuroParl (votes, laws, law-texts).
 *
 * Centralise la génération des IDs de lois PE et l'accès à l'API HTV
 * pour garantir la cohérence entre les modules.
 */

import { PE_SOURCES } from '../../config';

const HTV_API_BASE = PE_SOURCES.howTheyVoteApiUrl;

/**
 * Effectue une requête GET vers l'API HowTheyVote.eu.
 *
 * @template T Type de la réponse attendue
 * @param endpoint Chemin de l'API (ex: '/votes/12345', '/votes?page=1')
 * @returns Promesse résolue avec les données JSON typées
 * @throws {Error} Si la requête échoue (statut HTTP non-2xx)
 *
 * @example
 * ```typescript
 * // Récupérer un vote spécifique
 * const vote = await fetchHTV<HTVVote>('/votes/12345');
 *
 * // Lister les votes avec pagination
 * const list = await fetchHTV<HTVVoteListResponse>('/votes?page=1&page_size=100');
 * ```
 */
export async function fetchHTV<T>(endpoint: string): Promise<T> {
	const url = `${HTV_API_BASE}${endpoint}`;
	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'NosElus/1.0 (https://noselus.fr)'
		}
	});

	if (!response.ok) {
		throw new Error(`HTV API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Extrait le numéro de législature PE depuis une référence de procédure.
 *
 * Les références suivent des patterns comme :
 * - A10-0270/2025 → législature 10
 * - B9-0063/2026 → législature 9
 * - RC-B10-0071/2026 → législature 10 (références composites)
 * - C10-0263/2025 → législature 10
 *
 * Le(s) chiffre(s) après le préfixe lettre (A, B ou C) représentent la législature.
 *
 * @param reference Référence de procédure PE (ex: 'A10-0270/2025')
 * @returns Numéro de législature (ex: 10), ou null si le pattern ne correspond pas
 *
 * @example
 * ```typescript
 * extractTermFromReference('A10-0270/2025'); // 10
 * extractTermFromReference('B9-0063/2026');  // 9
 * extractTermFromReference('RC-B10-0071/2026'); // 10
 * extractTermFromReference('2024/1234');     // null (pas de pattern)
 * ```
 */
export function extractTermFromReference(reference: string): number | null {
	const match = reference.match(/[ABC](\d+)-/);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Génère un ID unique de loi PE au format standardisé.
 *
 * **CRITIQUE** : Cette fonction doit produire des IDs **identiques** dans tous les modules
 * (votes.ts, laws.ts, law-texts.ts) pour garantir le lien scrutin ↔ loi.
 *
 * Format généré : `LWPE{législature}-{référence-avec-tirets}`
 *
 * Stratégie :
 * 1. Tente d'extraire la législature depuis le pattern de référence (A9-, B10-, etc.)
 * 2. Sinon, utilise la législature courante (fallback)
 * 3. Remplace les slashes par des tirets pour respecter la contrainte DB (varchar(50))
 *
 * @param reference Référence de procédure PE (ex: 'A10-0270/2025', 'RC-B10-0071/2026')
 * @param fallbackTerm Législature à utiliser si extraction impossible (législature courante)
 * @returns ID unique au format LWPE{term}-{reference} (max 50 caractères)
 *
 * @example
 * ```typescript
 * // Extraction réussie : utilise la législature 9 depuis A9-*
 * generateLawId('A9-0045/2024', 10); // 'LWPE9-A9-0045-2024'
 *
 * // Extraction réussie : législature 10 depuis RC-B10-*
 * generateLawId('RC-B10-0071/2026', 10); // 'LWPE10-RC-B10-0071-2026'
 *
 * // Extraction échouée : utilise le fallback (législature 10)
 * generateLawId('2024/1234', 10); // 'LWPE10-2024-1234'
 * ```
 *
 * @see {@link extractTermFromReference} pour la logique d'extraction de législature
 */
export function generateLawId(reference: string, fallbackTerm: number): string {
	const term = extractTermFromReference(reference) ?? fallbackTerm;
	return `LWPE${term}-${reference.replace(/\//g, '-')}`;
}
