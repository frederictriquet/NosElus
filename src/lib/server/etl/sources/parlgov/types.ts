/**
 * Types pour l'intégration ParlGov
 *
 * ParlGov est une base de données académique des partis politiques européens
 * avec positionnement idéologique sur l'axe gauche-droite (0-10).
 *
 * @see https://www.parlgov.org/
 * @see ADR-004 : adr-2026-02-04-political-positioning-automation.md
 */

import type { Organ } from '$lib/server/db';

/**
 * Entrée brute du CSV ParlGov (view_party.csv)
 * Noms de colonnes tels qu'ils apparaissent dans le CSV
 */
export interface ParlGovPartyRaw {
	country_name_short: string; // "FRA"
	country_name: string; // "France"
	party_name_short: string; // "LFI"
	party_name_english: string; // "Unsubmissive France"
	party_name: string; // "La France insoumise"
	family_name_short: string; // "soc" | "com" | "lib" | etc.
	family_name: string; // "Social democracy"
	left_right: string; // "2.3" (échelle 0-10)
	state_market?: string; // Axe économique
	liberty_authority?: string; // Axe autoritaire
	eu_anti_pro?: string; // Position UE
}

/**
 * Parti politique ParlGov normalisé (après parsing)
 */
export interface ParlGovParty {
	/** Code pays ISO (ex: "FRA", "EUR") */
	countryCode: string;
	/** Nom court du parti (ex: "LFI") */
	shortName: string;
	/** Nom en anglais (ex: "Unsubmissive France") */
	nameEnglish: string;
	/** Nom dans la langue native (ex: "La France insoumise") */
	nameNative: string;
	/** Famille politique courte (ex: "soc", "com", "lib") */
	familyShort: string;
	/** Position gauche-droite (0-10), null si absente */
	leftRight: number | null;
}

/**
 * Champ sur lequel le matching a réussi
 */
export type MatchField = 'shortName' | 'nameNative' | 'nameEnglish';

/**
 * Résultat d'un matching entre un organ NosElus et un parti ParlGov
 */
export interface MatchResult {
	/** ID du groupe NosElus */
	organId: string;
	/** Nom du groupe NosElus */
	organName: string;
	/** Nom court du groupe NosElus */
	organShortName: string | null;
	/** Parti ParlGov matché */
	parlGovParty: ParlGovParty;
	/** Score de similarité Jaccard (0.0-1.0) */
	score: number;
	/** Champ sur lequel le match a été trouvé */
	matchedOn: MatchField;
}

/**
 * Organ avec position politique (pour le tri)
 */
export interface OrganWithPosition extends Pick<Organ, 'id' | 'shortName' | 'name'> {
	politicalPosition: number | null;
}

/**
 * Statistiques d'import
 */
export interface ImportStats {
	/** Total de partis récupérés depuis ParlGov */
	partiesFetched: number;
	/** Partis retenus après filtrage (FR/EU) */
	partiesFiltered: number;
	/** Groupes NosElus traités */
	organsProcessed: number;
	/** Groupes matchés avec succès */
	matched: number;
	/** Groupes sans match (fallback appliqué) */
	notMatched: number;
	/** Positions mises à jour en DB */
	updated: number;
	/** Nombre d'erreurs */
	errors: number;
	/** Durée totale en millisecondes */
	duration: number;
}

/**
 * Configuration du client ParlGov
 */
export interface ParlGovClientConfig {
	/** URL du CSV (défaut: view_party.csv officiel) */
	csvUrl?: string;
	/** Timeout en ms (défaut: 30000) */
	timeout?: number;
	/** Codes pays à inclure (défaut: ['FRA']) */
	countryCodes?: string[];
}

/**
 * Configuration du matcher
 */
export interface MatcherConfig {
	/** Seuil minimum de similarité Jaccard (défaut: 0.4) */
	threshold?: number;
	/** Bonus pour mots longs en commun (défaut: 0.2) */
	longWordBonus?: number;
	/** Longueur minimum pour un mot long (défaut: 8) */
	longWordMinLength?: number;
}

/**
 * Options de tri par position politique
 */
export interface SortOptions {
	/** Position pour les Non-Inscrits (défaut: 999) */
	niPosition?: number;
	/** Position par défaut si null (défaut: 5.0 = centre) */
	defaultPosition?: number;
	/** Identifiants des groupes NI */
	niIdentifiers?: string[];
}

/**
 * Familles politiques ParlGov avec positions par défaut
 * Utilisées comme fallback si le matching échoue
 */
export const FAMILY_POSITIONS: Record<string, number> = {
	com: 1.5, // Communist/Socialist → extrême gauche
	soc: 3.0, // Social democracy → gauche
	eco: 3.5, // Green/Ecologist → gauche
	agr: 4.5, // Agrarian → centre-gauche
	lib: 5.5, // Liberal → centre-droit
	chr: 6.0, // Christian democracy → droite
	con: 7.0, // Conservative → droite
	right: 8.5, // Right-wing → extrême droite
	spec: 5.0, // Special issue → centre
	none: 5.0 // No family → centre
};

/**
 * Identifiants courants pour les groupes Non-Inscrits
 */
export const NI_IDENTIFIERS = ['NI', 'NA', 'Non-inscrit', 'Non-inscrits', 'Indépendant'];

