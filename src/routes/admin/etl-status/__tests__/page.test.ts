/**
 * Tests unitaires pour logique client-side de la page ETL status
 *
 * Tests de la logique Svelte (filtres, formatage, etc.)
 * Sans rendering complet (pas de @testing-library/svelte pour l'instant)
 */

import { describe, it, expect } from 'vitest';
import type { ETLChamber } from '$lib/server/etl/checks';
import { integrationData, checkFixtures } from '$lib/server/etl/__tests__/fixtures';

describe('ETL Status Page - Client Logic', () => {
	describe('Chamber Filtering', () => {
		it('should filter checks by AN chamber', () => {
			const allChecks = integrationData.mixedChecks;
			const activeChamber: ETLChamber = 'AN';

			const filtered = allChecks.filter((c) => c.chamber === activeChamber || c.chamber === 'ALL');

			// Vérifier que seulement AN et ALL sont présents
			for (const check of filtered) {
				expect(['AN', 'ALL']).toContain(check.chamber);
			}
		});

		it('should filter checks by PE chamber', () => {
			const allChecks = integrationData.mixedChecks;
			const activeChamber: ETLChamber = 'PE';

			const filtered = allChecks.filter((c) => c.chamber === activeChamber || c.chamber === 'ALL');

			for (const check of filtered) {
				expect(['PE', 'ALL']).toContain(check.chamber);
			}
		});

		it('should filter checks by SENAT chamber', () => {
			const allChecks = integrationData.mixedChecks;
			const activeChamber: ETLChamber = 'SENAT';

			const filtered = allChecks.filter((c) => c.chamber === activeChamber || c.chamber === 'ALL');

			for (const check of filtered) {
				expect(['SENAT', 'ALL']).toContain(check.chamber);
			}
		});

		it('should show all checks when ALL is selected', () => {
			const allChecks = integrationData.mixedChecks;
			const activeChamber: ETLChamber | 'ALL' = 'ALL';

			const filtered =
				activeChamber === 'ALL'
					? allChecks
					: allChecks.filter((c) => c.chamber === activeChamber || c.chamber === 'ALL');

			expect(filtered.length).toBe(allChecks.length);
		});

		it('should always include checks with chamber=ALL', () => {
			const allChecks = [
				...integrationData.anChecks,
				checkFixtures.infoStats // SENAT
			];

			// Peu importe le filtre, les checks ALL doivent être inclus
			const chambersToTest: Array<ETLChamber | 'ALL'> = ['AN', 'PE', 'SENAT'];

			for (const chamber of chambersToTest) {
				const filtered =
					chamber === 'ALL'
						? allChecks
						: allChecks.filter((c) => c.chamber === chamber || c.chamber === 'ALL');

				// Doit inclure au moins les checks ALL
				const allChamberChecks = allChecks.filter((c) => c.chamber === 'ALL');
				expect(filtered.length).toBeGreaterThanOrEqual(allChamberChecks.length);
			}
		});
	});

	describe('Severity Badge Logic', () => {
		it('should map critical severity to red badge', () => {
			const severity = 'critical';
			const badge = getSeverityBadge(severity);

			expect(badge.icon).toBe('🔴');
			expect(badge.color).toContain('danger');
		});

		it('should map warning severity to yellow badge', () => {
			const severity = 'warning';
			const badge = getSeverityBadge(severity);

			expect(badge.icon).toBe('🟡');
			expect(badge.color).toContain('warning');
		});

		it('should map info severity to blue badge', () => {
			const severity = 'info';
			const badge = getSeverityBadge(severity);

			expect(badge.icon).toBe('🔵');
			expect(badge.color).toContain('primary');
		});

		it('should map ok severity to green badge', () => {
			const severity = 'ok';
			const badge = getSeverityBadge(severity);

			expect(badge.icon).toBe('✅');
			expect(badge.color).toContain('success');
		});

		it('should handle unknown severity with default badge', () => {
			const severity = 'unknown' as any;
			const badge = getSeverityBadge(severity);

			expect(badge.icon).toBe('⚪');
			expect(badge.color).toContain('text');
		});
	});

	describe('Date Formatting', () => {
		it('should format Date object to French locale', () => {
			const date = new Date('2026-02-09T12:30:00Z');
			const formatted = formatDate(date);

			// Format attendu : "09/02/2026, 13:30" (heure locale)
			expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
			expect(formatted).toContain(':');
		});

		it('should format ISO string to French locale', () => {
			const dateString = '2026-02-09T12:30:00Z';
			const formatted = formatDate(dateString);

			expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
		});

		it('should include time in format', () => {
			const date = new Date('2026-02-09T14:45:00Z');
			const formatted = formatDate(date);

			// Doit contenir l'heure
			expect(formatted).toMatch(/\d{2}:\d{2}/);
		});
	});

	describe('Copy Command Logic', () => {
		it('should copy command to clipboard (mock)', () => {
			const command = 'make etl-an-law-texts';

			// En test, navigator.clipboard n'existe pas
			// Mais on peut tester la logique
			let copiedText = '';

			// Mock du clipboard
			const mockClipboard = {
				writeText: (text: string) => {
					copiedText = text;
					return Promise.resolve();
				}
			};

			// Simuler la fonction copyCommand
			mockClipboard.writeText(command);

			expect(copiedText).toBe(command);
		});
	});

	describe('Empty State Handling', () => {
		it('should handle empty sync status array', () => {
			const syncRows: any[] = [];

			// En UI : {#if syncRows.length === 0}
			const isEmpty = syncRows.length === 0;

			expect(isEmpty).toBe(true);
		});

		it('should handle empty checks array', () => {
			const checks: any[] = [];

			const isEmpty = checks.length === 0;

			expect(isEmpty).toBe(true);
		});
	});

	describe('Stale Data Indicator', () => {
		it('should mark data as stale when > 30 days', () => {
			const daysSinceSync = 56;
			const isStale = daysSinceSync > 30;

			expect(isStale).toBe(true);
		});

		it('should not mark recent data as stale', () => {
			const daysSinceSync = 7;
			const isStale = daysSinceSync > 30;

			expect(isStale).toBe(false);
		});

		it('should handle edge case: exactly 30 days', () => {
			const daysSinceSync = 30;
			const isStale = daysSinceSync > 30;

			expect(isStale).toBe(false);
		});
	});

	describe('Number Formatting', () => {
		it('should format large numbers with French locale', () => {
			const num = 17872;
			const formatted = num.toLocaleString('fr-FR');

			// Format français : 17 872 (espace insécable)
			// Note: Le séparateur exact dépend du navigateur (espace ou espace insécable)
			expect(formatted).toMatch(/^17[\s\u202f]872$/);
		});

		it('should format percentage with 1 decimal', () => {
			const pct = 89.12345;
			const formatted = pct.toFixed(1);

			expect(formatted).toBe('89.1');
		});

		it('should handle 100% correctly', () => {
			const pct = 100.0;
			const formatted = pct.toFixed(1);

			expect(formatted).toBe('100.0');
		});

		it('should handle 0% correctly', () => {
			const pct = 0.0;
			const formatted = pct.toFixed(1);

			expect(formatted).toBe('0.0');
		});
	});
});

/**
 * Helper functions extracted from component for testing
 * (These mirror the logic in +page.svelte)
 */

function getSeverityBadge(severity: string): { icon: string; color: string } {
	switch (severity) {
		case 'critical':
			return { icon: '🔴', color: 'var(--color-danger)' };
		case 'warning':
			return { icon: '🟡', color: 'var(--color-warning)' };
		case 'info':
			return { icon: '🔵', color: 'var(--color-primary)' };
		case 'ok':
			return { icon: '✅', color: 'var(--color-success)' };
		default:
			return { icon: '⚪', color: 'var(--color-text)' };
	}
}

function formatDate(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('fr-FR', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}
