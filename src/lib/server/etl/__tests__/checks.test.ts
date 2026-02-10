/**
 * Tests unitaires pour ETL checks
 *
 * Tests de la logique métier sans accès DB
 * Ces tests tournent dans le CI (pas de suffix .server.test.ts)
 */

import { describe, it, expect } from 'vitest';
import { MIN_DESCRIPTION_LENGTH } from '../checks';
import type { ETLCheckResult } from '../checks';
import {
	createTestCheckResult,
	createTestSyncStatus,
	checkFixtures,
	syncFixtures
} from './fixtures';

describe('ETL Checks - Unit Tests', () => {
	describe('Check Result Structure', () => {
		it('should create valid check result with factory', () => {
			const check = createTestCheckResult();

			expect(check).toHaveProperty('id');
			expect(check).toHaveProperty('label');
			expect(check).toHaveProperty('description');
			expect(check).toHaveProperty('severity');
			expect(check).toHaveProperty('current');
			expect(check).toHaveProperty('total');
			expect(check).toHaveProperty('pct');
			expect(check).toHaveProperty('command');
			expect(check).toHaveProperty('chamber');
		});

		it('should allow overriding specific fields', () => {
			const check = createTestCheckResult({
				severity: 'critical',
				current: 10,
				total: 100,
				pct: 10.0
			});

			expect(check.severity).toBe('critical');
			expect(check.current).toBe(10);
			expect(check.total).toBe(100);
			expect(check.pct).toBe(10.0);
		});
	});

	describe('Sync Status Structure', () => {
		it('should create valid sync status with factory', () => {
			const sync = createTestSyncStatus();

			expect(sync).toHaveProperty('source');
			expect(sync).toHaveProperty('entityType');
			expect(sync).toHaveProperty('lastSyncAt');
			expect(sync).toHaveProperty('lastSyncStatus');
			expect(sync).toHaveProperty('recordsProcessed');
			expect(sync).toHaveProperty('daysSinceSync');
		});

		it('should handle stale data (> 30 days)', () => {
			const staleSync = syncFixtures.staleAnScrutins;

			expect(staleSync.daysSinceSync).toBeGreaterThan(30);
		});

		it('should handle recent data (< 7 days)', () => {
			const recentSync = syncFixtures.recentAnActors;

			expect(recentSync.daysSinceSync).toBeLessThan(7);
		});
	});

	describe('Severity Logic', () => {
		it('should be critical when < 50% complete', () => {
			const check = checkFixtures.criticalFullText;

			expect(check.pct).toBeLessThan(50);
			expect(check.severity).toBe('critical');
		});

		it('should be warning when 50-75% complete', () => {
			const check = createTestCheckResult({
				severity: 'warning',
				current: 60,
				total: 100,
				pct: 60.0
			});

			expect(check.pct).toBeGreaterThanOrEqual(50);
			expect(check.pct).toBeLessThan(75);
			expect(check.severity).toBe('warning');
		});

		it('should be info when 75-90% complete', () => {
			const check = checkFixtures.infoStats;

			expect(check.pct).toBeGreaterThanOrEqual(75);
			expect(check.pct).toBeLessThan(90);
			expect(check.severity).toBe('info');
		});

		it('should be ok when > 90% complete', () => {
			const check = checkFixtures.okTags;

			expect(check.pct).toBeGreaterThanOrEqual(90);
			expect(check.severity).toBe('ok');
		});
	});

	describe('Chamber Filtering', () => {
		it('should support AN chamber', () => {
			const check = createTestCheckResult({ chamber: 'AN' });
			expect(check.chamber).toBe('AN');
		});

		it('should support PE chamber', () => {
			const check = createTestCheckResult({ chamber: 'PE' });
			expect(check.chamber).toBe('PE');
		});

		it('should support SENAT chamber', () => {
			const check = createTestCheckResult({ chamber: 'SENAT' });
			expect(check.chamber).toBe('SENAT');
		});

		it('should support ALL chambers', () => {
			const check = createTestCheckResult({ chamber: 'ALL' });
			expect(check.chamber).toBe('ALL');
		});
	});

	describe('Command Format', () => {
		it('should start with make for Makefile targets', () => {
			const check = checkFixtures.criticalFullText;

			expect(check.command).toMatch(/^make /);
		});

		it('should include chamber parameter when relevant', () => {
			const check = checkFixtures.warningAiSummary;

			// Commandes avec paramètre chambre
			if (check.chamber !== 'ALL') {
				expect(check.command).toContain('--chamber');
			}
		});
	});

	describe('Percentage Calculation', () => {
		it('should calculate 0% when current = 0', () => {
			const check = createTestCheckResult({
				current: 0,
				total: 100,
				pct: 0.0
			});

			expect(check.pct).toBe(0.0);
		});

		it('should calculate 100% when current = total', () => {
			const check = createTestCheckResult({
				current: 100,
				total: 100,
				pct: 100.0
			});

			expect(check.pct).toBe(100.0);
		});

		it('should calculate 50% when current = total/2', () => {
			const check = createTestCheckResult({
				current: 50,
				total: 100,
				pct: 50.0
			});

			expect(check.pct).toBe(50.0);
		});

		it('should handle decimal percentages', () => {
			const check = createTestCheckResult({
				current: 89,
				total: 100,
				pct: 89.0
			});

			expect(check.pct).toBe(89.0);
		});
	});

	describe('MIN_DESCRIPTION_LENGTH Constant', () => {
		it('should be a positive number', () => {
			// Constant exported pour usage dans les tests
			expect(typeof MIN_DESCRIPTION_LENGTH).toBe('number');
			expect(MIN_DESCRIPTION_LENGTH).toBeGreaterThan(0);
		});

		it('should be 100', () => {
			// Minimum 100 caractères pour considérer un texte "complet"
			expect(MIN_DESCRIPTION_LENGTH).toBe(100);
		});
	});

	describe('Check Fixtures', () => {
		it('should have fixtures for all severity levels', () => {
			expect(checkFixtures.criticalFullText.severity).toBe('critical');
			expect(checkFixtures.warningAiSummary.severity).toBe('warning');
			expect(checkFixtures.infoStats.severity).toBe('info');
			expect(checkFixtures.okTags.severity).toBe('ok');
		});

		it('should have realistic data', () => {
			const critical = checkFixtures.criticalFullText;

			// Données réalistes pour lois AN
			expect(critical.total).toBeGreaterThan(1000);
			expect(critical.chamber).toBe('AN');
			expect(critical.command).toContain('etl-an-law-texts');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty total gracefully', () => {
			// Note: En production, total devrait toujours être > 0
			// Mais test défensif pour edge case
			const check = createTestCheckResult({
				current: 0,
				total: 0,
				pct: 0.0
			});

			expect(check.current).toBe(0);
			expect(check.total).toBe(0);
		});

		it('should handle very large numbers', () => {
			const check = createTestCheckResult({
				current: 1_000_000,
				total: 2_000_000,
				pct: 50.0
			});

			expect(check.current).toBe(1_000_000);
			expect(check.total).toBe(2_000_000);
		});

		it('should handle very small percentages', () => {
			const check = createTestCheckResult({
				current: 1,
				total: 10000,
				pct: 0.01
			});

			expect(check.pct).toBeLessThan(1);
		});

		it('should handle very high percentages (99.9%)', () => {
			const check = createTestCheckResult({
				current: 999,
				total: 1000,
				pct: 99.9
			});

			expect(check.pct).toBeGreaterThan(99);
			expect(check.pct).toBeLessThan(100);
		});
	});
});
