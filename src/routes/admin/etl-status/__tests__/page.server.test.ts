/**
 * Tests d'intégration pour route /admin/etl-status
 *
 * Note : Tests d'intégration avec DB réelle
 * Suffix `.server.test.ts` = exclus du CI
 */

import { describe, it, expect } from 'vitest';
import { load } from '../+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callLoad = () => (load as any)({});

describe('Admin ETL Status Page - Integration', () => {
	describe('Loader Function', () => {
		it('should return object with syncStatus and etlChecks promises', async () => {
			const result = await callLoad();

			expect(result).toHaveProperty('syncStatus');
			expect(result).toHaveProperty('etlChecks');

			// Les valeurs doivent être des promises (pattern SvelteKit streaming)
			expect(result.syncStatus).toBeInstanceOf(Promise);
			expect(result.etlChecks).toBeInstanceOf(Promise);
		});

		it('should resolve syncStatus to array of sync rows', async () => {
			const result = await callLoad();

			// Résoudre la promise
			const syncStatus = await result.syncStatus;

			// Graceful degradation si pas de données
			if (syncStatus.length === 0) {
				console.warn('No sync_metadata data, skipping test');
				return;
			}

			// Vérifier structure
			expect(Array.isArray(syncStatus)).toBe(true);
			expect(syncStatus.length).toBeGreaterThan(0);

			// Vérifier premier élément
			const first = syncStatus[0];
			expect(first).toHaveProperty('source');
			expect(first).toHaveProperty('entityType');
			expect(first).toHaveProperty('lastSyncAt');
			expect(first).toHaveProperty('lastSyncStatus');
			expect(first).toHaveProperty('recordsProcessed');
			expect(first).toHaveProperty('daysSinceSync');
		});

		it('should resolve etlChecks to array of check results', async () => {
			const result = await callLoad();

			// Résoudre la promise
			const etlChecks = await result.etlChecks;

			// Graceful degradation
			if (etlChecks.length === 0) {
				console.warn('No ETL checks returned, skipping test');
				return;
			}

			// Vérifier structure
			expect(Array.isArray(etlChecks)).toBe(true);
			expect(etlChecks.length).toBeGreaterThan(0);

			// Vérifier premier élément
			const first = etlChecks[0];
			expect(first).toHaveProperty('id');
			expect(first).toHaveProperty('label');
			expect(first).toHaveProperty('severity');
			expect(first).toHaveProperty('chamber');
			expect(first).toHaveProperty('command');
		});

		it('should not await promises (SvelteKit streaming pattern)', () => {
			const result = callLoad();

			// Result ne doit pas être une promise
			expect(result).not.toBeInstanceOf(Promise);

			// Mais contenir des promises
			expect(result).toHaveProperty('syncStatus');
			expect(result).toHaveProperty('etlChecks');
		});
	});

	describe('SvelteKit Streaming Pattern', () => {
		it('should allow progressive rendering of sections', async () => {
			const result = callLoad();

			// Les promises doivent être indépendantes
			// On peut en résoudre une sans l'autre
			const syncStatusResolved = await result.syncStatus;
			expect(syncStatusResolved).toBeDefined();

			// L'autre promise n'est pas encore forcément résolue
			// mais doit être résoluble
			const etlChecksResolved = await result.etlChecks;
			expect(etlChecksResolved).toBeDefined();
		});
	});
});
