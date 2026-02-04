/**
 * Module ParlGov - Positionnement politique des partis
 *
 * Ce module permet de récupérer les positions politiques depuis ParlGov
 * et de les associer aux groupes parlementaires NosElus.
 *
 * @example
 * ```typescript
 * import { fetchPartiesForCountries, findBestMatch, determinePosition } from '$lib/server/etl/sources/parlgov';
 *
 * const parties = await fetchPartiesForCountries({ countryCodes: ['FRA'] });
 * const match = findBestMatch(organ, parties);
 * const position = determinePosition(organ, match);
 * ```
 *
 * @see ADR-004 : adr-2026-02-04-political-positioning-automation.md
 */

// Types
export type {
	ParlGovParty,
	ParlGovPartyRaw,
	MatchResult,
	MatchField,
	ImportStats,
	ParlGovClientConfig,
	MatcherConfig,
	SortOptions,
	OrganWithPosition
} from './types';

export { FAMILY_POSITIONS, NI_IDENTIFIERS } from './types';

// Client
export {
	fetchAllParties,
	filterByCountry,
	fetchPartiesForCountries,
	testConnection,
	ParlGovFetchError
} from './client';

// Matcher
export {
	normalizeForMatching,
	calculateJaccardSimilarity,
	findBestMatch,
	isNonInscrit,
	determinePosition,
	matchAll
} from './matcher';
