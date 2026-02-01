/**
 * Configuration centralisée des sources ETL
 *
 * Ce fichier regroupe toutes les URLs et constantes des sources de données externes.
 * Pour modifier une URL, il suffit de changer la valeur ici.
 */

// =============================================================================
// ASSEMBLÉE NATIONALE
// =============================================================================

export const AN_SOURCES = {
	/** Base URL pour les données ouvertes AN */
	baseUrl: 'https://data.assemblee-nationale.fr',

	/** URL pour les acteurs et mandats */
	actorsUrl:
		'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes_divises/AMO30_deputes_actifs_mandats_actifs_organes_divises.json.zip',

	/** URLs des scrutins par législature */
	scrutinsUrls: {
		15: 'https://data.assemblee-nationale.fr/static/openData/repository/15/loi/scrutins/Scrutins_XV.json.zip',
		16: 'https://data.assemblee-nationale.fr/static/openData/repository/16/loi/scrutins/Scrutins_XVI.json.zip',
		17: 'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins_XVII.json.zip'
	} as Record<number, string>,

	/** URLs des amendements par législature */
	amendementsUrls: {
		15: 'https://data.assemblee-nationale.fr/static/openData/repository/15/loi/amendements_legis/Amendements_XV.json.zip',
		16: 'https://data.assemblee-nationale.fr/static/openData/repository/16/loi/amendements_legis/Amendements_XVI.json.zip',
		17: 'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/amendements_legis/Amendements_XVII.json.zip'
	} as Record<number, string>,

	/** URL de base pour les photos */
	photosBaseUrl: 'https://www.assemblee-nationale.fr/'
} as const;

// =============================================================================
// SÉNAT
// =============================================================================

export const SENAT_SOURCES = {
	/** API REST des sénateurs en exercice */
	senatorsApiUrl: 'https://www.senat.fr/api-senat/senateurs.json',

	/** Dossiers législatifs (CSV) */
	lawsUrl: 'https://data.senat.fr/data/dosleg/dossiers-legislatifs.csv',

	/** Historique des mandats - plusieurs fichiers */
	mandatesHistoryUrls: {
		current: 'https://data.senat.fr/data/senateurs/ODSEN_GENERAL.csv',
		history: 'https://data.senat.fr/data/senateurs/ODSEN_SENam.csv',
		addresses: 'https://data.senat.fr/data/senateurs/ODSEN_ELUAM.csv'
	},

	/** Calendrier d'activité (JSON) */
	activityCalendarUrl: 'https://www.senat.fr/calendrier_activite/json'
} as const;

// =============================================================================
// PARLEMENT EUROPÉEN
// =============================================================================

export const PE_SOURCES = {
	/** Dump ParlTrack des MEPs (compressé zstd) */
	parltrackMepsUrl: 'https://parltrack.org/dumps/ep_meps.json.zst',

	/** API HowTheyVote pour les votes */
	howTheyVoteApiUrl: 'https://howtheyvote.eu/api'
} as const;

// =============================================================================
// SOURCES ARCHIVES / TIERCES
// =============================================================================

export const ARCHIVE_SOURCES = {
	/** NosDéputés.fr - données d'activité */
	nosDeputesBaseUrl: 'https://www.nosdeputes.fr',

	/** NosSénateurs.fr - archive */
	nosSenateursSynthese: 'https://archive.nossenateurs.fr/synthese/data/json'
} as const;

// =============================================================================
// CONFIGURATION COMMUNE
// =============================================================================

export const ETL_CONFIG = {
	/** User-Agent pour les requêtes HTTP */
	userAgent: 'NosElus/1.0 (https://noselus.fr)',

	/** Taille de batch par défaut */
	defaultBatchSize: parseInt(process.env.ETL_BATCH_SIZE || '100', 10),

	/** Répertoire de cache */
	cacheDir: process.env.ETL_CACHE_DIR || 'data/cache',

	/** Durées de cache par défaut (en heures) */
	cacheTtl: {
		meps: 24,
		votes: 6,
		senators: 24,
		deputies: 24
	}
} as const;

// =============================================================================
// MAPPINGS
// =============================================================================

/** Mapping des IDs d'organes AN par législature */
export const AN_LEGISLATURE_ORGAN_IDS: Record<number, string> = {
	11: 'PO230433',
	12: 'PO230434',
	13: 'PO421825',
	14: 'PO645633',
	15: 'PO717460',
	16: 'PO793087',
	17: 'PO838901'
};

/** Mapping codes groupes HowTheyVote → ParlTrack */
export const PE_GROUP_CODE_MAP: Record<string, string> = {
	EPP: 'PPE',
	SD: 'S&D',
	RENEW: 'RE',
	GREEN_EFA: 'Verts/ALE',
	GUE_NGL: 'GUE/NGL',
	ECR: 'ECR',
	PFE: 'Patriots for Europe Group',
	ESN: 'Europe of Sovereign Nations Group',
	NI: 'NA'
};

/** Mapping positions de vote HowTheyVote → format interne */
export const PE_POSITION_MAP: Record<string, string> = {
	FOR: 'pour',
	AGAINST: 'contre',
	ABSTENTION: 'abstention',
	DID_NOT_VOTE: 'non-votant'
};

/**
 * Dates officielles des termes PE (source: europarl.europa.eu)
 * @hardcoded-ok: ces dates sont des faits historiques officiels de l'UE
 *
 * Ces dates sont utilisées pour l'import ETL initial et comme fallback.
 * Une fois les mandats importés, les dates réelles sont calculées depuis la BD.
 */
export const PE_OFFICIAL_TERM_DATES: Record<number, { start: string; end: string | null }> = {
	6: { start: '2004-07-20', end: '2009-07-13' },
	7: { start: '2009-07-14', end: '2014-06-30' },
	8: { start: '2014-07-01', end: '2019-07-01' },
	9: { start: '2019-07-02', end: '2024-07-15' },
	10: { start: '2024-07-16', end: null }
};

/** Terme PE minimum pour l'import historique (2004) */
export const PE_HISTORICAL_MIN_TERM = 6;
