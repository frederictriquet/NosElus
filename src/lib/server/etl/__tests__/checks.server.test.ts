/**
 * Tests d'intégration pour ETL checks
 *
 * Note : Suffix `.server.test.ts` indique des tests d'intégration DB
 * Ces tests sont exclus du CI (voir vitest.config.ts)
 * Exécution locale uniquement : `npx vitest run src/**/*.server.test.ts`
 *
 * @see pattern-integration-tests-real-db.md
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadSyncStatus, loadETLChecks } from '../checks';
import type { SyncStatusRow, ETLCheckResult } from '../checks';

describe('ETL Checks - Integration Tests', () => {
	describe('loadSyncStatus()', () => {
		it('should return sync metadata rows when data exists', async () => {
			const result = await loadSyncStatus();

			// Graceful degradation si DB vide
			if (result.length === 0) {
				console.warn('No sync_metadata data found, skipping test');
				return;
			}

			// Vérifier la structure
			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);

			// Vérifier qu'au moins une ligne a tous les champs requis
			const firstRow = result[0];
			expect(firstRow).toHaveProperty('source');
			expect(firstRow).toHaveProperty('entityType');
			expect(firstRow).toHaveProperty('lastSyncAt');
			expect(firstRow).toHaveProperty('lastSyncStatus');
			expect(firstRow).toHaveProperty('recordsProcessed');
			expect(firstRow).toHaveProperty('daysSinceSync');

			// Types
			expect(typeof firstRow.source).toBe('string');
			expect(typeof firstRow.entityType).toBe('string');
			expect(firstRow.lastSyncAt).toBeInstanceOf(Date);
			expect(typeof firstRow.lastSyncStatus).toBe('string');
			expect(typeof firstRow.recordsProcessed).toBe('number');
			expect(typeof firstRow.daysSinceSync).toBe('number');
		});

		it('should calculate daysSinceSync correctly', async () => {
			const result = await loadSyncStatus();

			if (result.length === 0) {
				console.warn('No sync_metadata data found, skipping test');
				return;
			}

			// Tous les résultats doivent avoir daysSinceSync >= 0
			for (const row of result) {
				expect(row.daysSinceSync).toBeGreaterThanOrEqual(0);
			}
		});

		it('should order by lastSyncAt DESC (most recent first)', async () => {
			const result = await loadSyncStatus();

			if (result.length < 2) {
				console.warn('Not enough sync_metadata data for ordering test');
				return;
			}

			// Vérifier que chaque élément est >= au suivant
			for (let i = 0; i < result.length - 1; i++) {
				const current = result[i].lastSyncAt.getTime();
				const next = result[i + 1].lastSyncAt.getTime();
				expect(current).toBeGreaterThanOrEqual(next);
			}
		});
	});

	describe('loadETLChecks()', () => {
		let checksResult: ETLCheckResult[];

		beforeAll(async () => {
			checksResult = await loadETLChecks();
		});

		it('should return array of ETL check results', () => {
			expect(checksResult).toBeInstanceOf(Array);
			expect(checksResult.length).toBeGreaterThan(0);
		});

		it('should have valid structure for each check', () => {
			// Graceful degradation
			if (checksResult.length === 0) {
				console.warn('No ETL checks returned, skipping validation');
				return;
			}

			for (const check of checksResult) {
				// Champs requis
				expect(check).toHaveProperty('id');
				expect(check).toHaveProperty('label');
				expect(check).toHaveProperty('description');
				expect(check).toHaveProperty('severity');
				expect(check).toHaveProperty('current');
				expect(check).toHaveProperty('total');
				expect(check).toHaveProperty('pct');
				expect(check).toHaveProperty('command');
				expect(check).toHaveProperty('chamber');

				// Types
				expect(typeof check.id).toBe('string');
				expect(typeof check.label).toBe('string');
				expect(typeof check.description).toBe('string');
				expect(typeof check.severity).toBe('string');
				expect(typeof check.current).toBe('number');
				expect(typeof check.total).toBe('number');
				expect(typeof check.pct).toBe('number');
				expect(typeof check.command).toBe('string');
				expect(typeof check.chamber).toBe('string');
			}
		});

		it('should have valid severity levels', () => {
			if (checksResult.length === 0) return;

			const validSeverities = ['critical', 'warning', 'info', 'ok'];

			for (const check of checksResult) {
				expect(validSeverities).toContain(check.severity);
			}
		});

		it('should have valid chamber values', () => {
			if (checksResult.length === 0) return;

			const validChambers = ['AN', 'PE', 'SENAT', 'ALL'];

			for (const check of checksResult) {
				expect(validChambers).toContain(check.chamber);
			}
		});

		it('should calculate percentage correctly', () => {
			if (checksResult.length === 0) return;

			for (const check of checksResult) {
				// Tolérance pour arrondi flottant
				const expectedPct = (check.current / check.total) * 100;
				expect(Math.abs(check.pct - expectedPct)).toBeLessThan(0.1);
			}
		});

		it('should have percentage between 0 and 100', () => {
			if (checksResult.length === 0) return;

			for (const check of checksResult) {
				expect(check.pct).toBeGreaterThanOrEqual(0);
				expect(check.pct).toBeLessThanOrEqual(100);
			}
		});

		it('should have current <= total', () => {
			if (checksResult.length === 0) return;

			for (const check of checksResult) {
				expect(check.current).toBeLessThanOrEqual(check.total);
			}
		});

		it('should have non-empty command', () => {
			if (checksResult.length === 0) return;

			for (const check of checksResult) {
				expect(check.command.length).toBeGreaterThan(0);
				// Commandes doivent commencer par "make" ou "npm run"
				expect(
					check.command.startsWith('make ') || check.command.startsWith('npm run ')
				).toBe(true);
			}
		});

		it('should have unique check IDs', () => {
			if (checksResult.length === 0) return;

			const ids = checksResult.map((c) => c.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});

		it('should assign appropriate severity based on percentage', () => {
			if (checksResult.length === 0) return;

			for (const check of checksResult) {
				// Logique de sévérité selon les specs :
				// critical: > 50% manquant (< 50% complétude)
				// warning: 25-50% manquant (50-75% complétude)
				// info: 10-25% manquant (75-90% complétude)
				// ok: < 10% manquant (> 90% complétude)

				if (check.pct < 50) {
					expect(check.severity).toBe('critical');
				} else if (check.pct < 75) {
					expect(check.severity).toBe('warning');
				} else if (check.pct < 90) {
					expect(check.severity).toBe('info');
				} else {
					expect(check.severity).toBe('ok');
				}
			}
		});
	});

	describe('ETL Checks Coverage', () => {
		it('should include data freshness checks', async () => {
			const checks = await loadETLChecks();

			// Au moins un check sur fraîcheur des données
			const freshnessChecks = checks.filter((c) => c.id.includes('freshness'));
			expect(freshnessChecks.length).toBeGreaterThan(0);
		});

		it('should include AN chamber checks', async () => {
			const checks = await loadETLChecks();

			// Au moins un check pour l'AN
			const anChecks = checks.filter((c) => c.chamber === 'AN');
			expect(anChecks.length).toBeGreaterThan(0);
		});

		it('should include PE chamber checks', async () => {
			const checks = await loadETLChecks();

			// Au moins un check pour le PE
			const peChecks = checks.filter((c) => c.chamber === 'PE');
			expect(peChecks.length).toBeGreaterThan(0);
		});
	});
});
