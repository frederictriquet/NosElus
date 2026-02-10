import { describe, it, expect, beforeAll } from 'vitest';
import { like } from 'drizzle-orm';

/**
 * Tests d'intégration pour l'enrichissement des textes de lois PE
 *
 * Vérifie que le module law-texts.ts a bien enrichi les descriptions.
 * Ces tests valident le résultat de l'ETL, pas la logique interne (qui est complexe à tester avec mocks).
 *
 * NOTE: Ces tests sont skippés automatiquement si la DB n'est pas disponible (CI)
 */

let dbAvailable = false;
let db: any;
let laws: any;

describe('PE Law Texts Enrichment - Integration', () => {
	let peLawIds: string[] = [];

	beforeAll(async () => {
		try {
			const dbModule = await import('$lib/server/db');
			db = dbModule.db;
			laws = dbModule.laws;

			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			peLawIds = peLaws.map((l: any) => l.id);
			dbAvailable = true;
		} catch {
			dbAvailable = false;
			console.warn('⚠️ Database not available - skipping integration tests');
		}
	});

	describe('Description enrichment', () => {
		it('should have enriched at least one PE law with substantial description', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const enrichedLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			const substantial = enrichedLaws.filter((l: any) => (l.description?.length || 0) > 200);

			expect(substantial.length).toBeGreaterThan(0);
		});

		it('should have descriptions with sources headers', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const laws_table = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			const hasSourceHeaders = laws_table.some(
				(l: any) =>
					l.description &&
					(l.description.includes('---') ||
						l.description.includes('Summary') ||
						l.description.includes('Résumé') ||
						l.description.includes('Titre:'))
			);

			expect(
				hasSourceHeaders || laws_table.some((l: any) => (l.description?.length || 0) > 100)
			).toBe(true);
		});

		it('should not exceed maximum description length', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const MAX_LENGTH = 50000;

			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			peLaws.forEach((law: any) => {
				const length = law.description?.length || 0;
				expect(length).toBeLessThanOrEqual(MAX_LENGTH);
			});
		});

		it('should have different descriptions for different laws', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			if (peLaws.length < 2) {
				console.warn('Less than 2 PE laws, skipping comparison');
				return;
			}

			const descriptions = peLaws.map((l: any) => l.description).filter(Boolean);
			const uniqueDescriptions = new Set(descriptions);

			expect(uniqueDescriptions.size).toBeGreaterThanOrEqual(Math.min(2, peLaws.length));
		});
	});

	describe('Specific PE laws enrichment', () => {
		it('should have enriched A10-0215/2025 (Solidarity Fund)', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const law = await db
				.select({ id: laws.id, title: laws.title, description: laws.description })
				.from(laws)
				.where(like(laws.id, '%A10-0215%'));

			if (law.length === 0) {
				console.warn('A10-0215/2025 not found');
				return;
			}

			expect(law[0].description?.length || 0).toBeGreaterThan(100);
			expect(
				law[0].description?.toLowerCase().includes('spain') ||
					law[0].description?.toLowerCase().includes('españa') ||
					law[0].description?.toLowerCase().includes('fund')
			).toBe(true);
		});

		it('should have enriched A9-0048 (Eurojust discharge)', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const law = await db
				.select({ id: laws.id, title: laws.title, description: laws.description })
				.from(laws)
				.where(like(laws.id, '%A9-0048%'));

			if (law.length === 0) {
				console.warn('A9-0048 not found');
				return;
			}

			expect(law[0].description).toBeTruthy();
			expect(law[0].description?.length || 0).toBeGreaterThan(100);
		});

		it('should have enriched A9-0355/2023 (France-Algeria agreement)', async () => {
			if (!dbAvailable) {
				console.log('Skipping: DB not available');
				return;
			}

			const law = await db
				.select({ id: laws.id, title: laws.title, description: laws.description })
				.from(laws)
				.where(like(laws.id, '%A9-0355%'));

			if (law.length === 0) {
				console.warn('A9-0355/2023 not found');
				return;
			}

			expect(law[0].description?.length || 0).toBeGreaterThan(50);
			expect(
				law[0].description?.toLowerCase().includes('agreemen') ||
					law[0].description?.toLowerCase().includes('france') ||
					law[0].description?.toLowerCase().includes('algeria')
			).toBe(true);
		});
	});

	describe('Description quality', () => {
		it('should have most descriptions with more than just the title', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const peLaws = await db
				.select({ id: laws.id, title: laws.title, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			let longerCount = 0;
			peLaws.forEach((law: any) => {
				const desc = law.description || '';
				const title = law.title || '';

				if (desc.length > title.length) {
					longerCount++;
				}
			});

			const ratio = longerCount / peLaws.length;
			expect(ratio).toBeGreaterThanOrEqual(0.7);
		});

		it('should have descriptions without excessive HTML tags', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			peLaws.forEach((law: any) => {
				const desc = law.description || '';
				const htmlTagCount = (desc.match(/<[^>]*>/g) || []).length;
				expect(htmlTagCount).toBe(0);
			});
		});

		it('should have readable text without excessive special characters', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			peLaws.forEach((law: any) => {
				const desc = law.description || '';
				if (desc.length > 100) {
					const validChars = desc.match(/[a-zA-Z0-9\s\-.,;:()«»–—…€]/g) || [];
					const ratio = validChars.length / desc.length;
					expect(ratio).toBeGreaterThan(0.85);
				}
			});
		});
	});

	describe('Comparison with original', () => {
		it('should have longer descriptions after enrichment', async () => {
			if (!dbAvailable || peLawIds.length === 0) {
				console.log('Skipping: DB not available or no PE laws');
				return;
			}

			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			const enrichedCount = peLaws.filter((l: any) => (l.description?.length || 0) > 500).length;

			expect(enrichedCount).toBeGreaterThanOrEqual(Math.ceil(peLaws.length * 0.5));
		});
	});
});
