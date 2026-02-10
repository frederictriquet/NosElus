/**
 * Fixtures et factories pour tests ETL checks
 *
 * Patterns :
 * - Test factories pour créer des données de test réutilisables
 * - Fixtures réalistes basées sur la structure DB réelle
 * - Support des overrides pour personnalisation
 */

import type { ETLCheckResult, SyncStatusRow } from '../checks';

/**
 * Factory pour créer une ligne de sync_metadata de test
 */
export function createTestSyncStatus(overrides?: Partial<SyncStatusRow>): SyncStatusRow {
	return {
		source: 'test-source',
		entityType: 'test-entity',
		lastSyncAt: new Date('2026-02-09T12:00:00Z'),
		lastSyncStatus: 'success',
		recordsProcessed: 100,
		daysSinceSync: 1,
		...overrides
	};
}

/**
 * Factory pour créer un résultat de check ETL de test
 */
export function createTestCheckResult(overrides?: Partial<ETLCheckResult>): ETLCheckResult {
	return {
		id: 'test-check',
		label: 'Test Check',
		description: 'Test description',
		severity: 'info',
		current: 80,
		total: 100,
		pct: 80.0,
		command: 'make test-command',
		chamber: 'ALL',
		...overrides
	};
}

/**
 * Fixtures de synchronisation réalistes
 */
export const syncFixtures = {
	// Sync récent (< 7 jours)
	recentAnActors: createTestSyncStatus({
		source: 'an-actors',
		entityType: 'deputies',
		lastSyncAt: new Date('2026-02-08T10:00:00Z'),
		recordsProcessed: 577,
		daysSinceSync: 1
	}),

	// Sync vieux (> 30 jours)
	staleAnScrutins: createTestSyncStatus({
		source: 'an-scrutins',
		entityType: 'scrutins',
		lastSyncAt: new Date('2025-12-15T10:00:00Z'),
		recordsProcessed: 17872,
		daysSinceSync: 56
	}),

	// Sync PE récent
	recentPeVotes: createTestSyncStatus({
		source: 'pe-votes',
		entityType: 'votes',
		lastSyncAt: new Date('2026-02-07T14:30:00Z'),
		recordsProcessed: 2204,
		daysSinceSync: 2
	}),

	// Sync avec erreur
	failedSync: createTestSyncStatus({
		source: 'an-laws',
		entityType: 'laws',
		lastSyncStatus: 'error',
		recordsProcessed: 0,
		daysSinceSync: 10
	})
};

/**
 * Fixtures de checks avec différents niveaux de sévérité
 */
export const checkFixtures = {
	// Critical : < 50% de complétude
	criticalFullText: createTestCheckResult({
		id: 'an-laws-full-text',
		label: 'Textes complets AN',
		description: 'Textes avec description complète (>100 caractères)',
		severity: 'critical',
		current: 1200,
		total: 3000,
		pct: 40.0,
		command: 'make etl-an-law-texts',
		chamber: 'AN'
	}),

	// Warning : 25-50% de complétude
	warningAiSummary: createTestCheckResult({
		id: 'pe-laws-ai-summary',
		label: 'Résumés IA PE',
		description: 'Lois avec résumé généré par IA',
		severity: 'warning',
		current: 800,
		total: 2000,
		pct: 40.0,
		command: 'make etl-analyze-laws -- --chamber PE',
		chamber: 'PE'
	}),

	// Info : 10-25% manquant
	infoStats: createTestCheckResult({
		id: 'senat-actor-stats',
		label: 'Statistiques sénateurs',
		description: "Sénateurs avec statistiques d'activité",
		severity: 'info',
		current: 310,
		total: 348,
		pct: 89.1,
		command: 'make etl-senat-activity-stats',
		chamber: 'SENAT'
	}),

	// Ok : > 90% de complétude
	okTags: createTestCheckResult({
		id: 'an-laws-tags',
		label: 'Tags thématiques AN',
		description: 'Lois avec au moins un tag',
		severity: 'ok',
		current: 2900,
		total: 3000,
		pct: 96.7,
		command: 'make etl-an-classify-scrutins',
		chamber: 'AN'
	})
};

/**
 * Jeux de données pour tests d'intégration
 */
export const integrationData = {
	// Ensemble de checks mixtes
	mixedChecks: [
		checkFixtures.criticalFullText,
		checkFixtures.warningAiSummary,
		checkFixtures.infoStats,
		checkFixtures.okTags
	],

	// Checks filtrables par chambre
	anChecks: [
		checkFixtures.criticalFullText,
		createTestCheckResult({
			id: 'an-scrutins-link',
			label: 'Scrutins liés à des lois',
			chamber: 'AN',
			pct: 75.0
		})
	],

	peChecks: [
		checkFixtures.warningAiSummary,
		createTestCheckResult({
			id: 'pe-data-freshness',
			label: 'Fraîcheur données PE',
			chamber: 'PE',
			pct: 100.0,
			severity: 'ok'
		})
	],

	// État de synchronisation complet
	fullSyncStatus: [
		syncFixtures.recentAnActors,
		syncFixtures.staleAnScrutins,
		syncFixtures.recentPeVotes,
		syncFixtures.failedSync
	]
};
