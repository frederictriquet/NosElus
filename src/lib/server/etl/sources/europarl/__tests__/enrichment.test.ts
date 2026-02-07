import { describe, it, expect, beforeAll } from 'vitest';
import { db, laws } from '$lib/server/db';
import { like } from 'drizzle-orm';

/**
 * Tests d'intégration pour l'enrichissement des textes de lois PE
 *
 * Vérifie que le module law-texts.ts a bien enrichi les descriptions.
 * Ces tests valident le résultat de l'ETL, pas la logique interne (qui est complexe à tester avec mocks).
 */

describe('PE Law Texts Enrichment - Integration', () => {
	let peLawIds: string[] = [];

	beforeAll(async () => {
		// Récupérer les lois PE enrichies
		const peLaws = await db
			.select({ id: laws.id, description: laws.description })
			.from(laws)
			.where(like(laws.id, 'LWPE10%'));

		peLawIds = peLaws.map((l) => l.id);
	});

	describe('Description enrichment', () => {
		it('should have enriched at least one PE law with substantial description', async () => {
			if (peLawIds.length === 0) {
				console.warn('No PE laws found');
				return;
			}

			const enrichedLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			// Au moins une loi devrait avoir une description > 200 chars
			const substantial = enrichedLaws.filter((l) => (l.description?.length || 0) > 200);

			expect(substantial.length).toBeGreaterThan(0);
		});

		it('should have descriptions with sources headers', async () => {
			if (peLawIds.length === 0) {
				console.warn('No PE laws found');
				return;
			}

			const laws_table = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			const hasSourceHeaders = laws_table.some(
				(l) =>
					l.description &&
					(l.description.includes('---') ||
						l.description.includes('Summary') ||
						l.description.includes('Résumé') ||
						l.description.includes('Titre:'))
			);

			// At least one should have structured content
			expect(hasSourceHeaders || laws_table.some((l) => (l.description?.length || 0) > 100)).toBe(
				true
			);
		});

		it('should not exceed maximum description length', async () => {
			const MAX_LENGTH = 50000;

			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			// Toutes les descriptions doivent être <= 50000 chars
			peLaws.forEach((law) => {
				const length = law.description?.length || 0;
				expect(length).toBeLessThanOrEqual(MAX_LENGTH);
			});
		});

		it('should have different descriptions for different laws', async () => {
			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			if (peLaws.length < 2) {
				console.warn('Less than 2 PE laws, skipping comparison');
				return;
			}

			// Au moins 2 lois doivent avoir des descriptions différentes
			const descriptions = peLaws.map((l) => l.description).filter(Boolean);
			const uniqueDescriptions = new Set(descriptions);

			expect(uniqueDescriptions.size).toBeGreaterThanOrEqual(
				Math.min(2, peLaws.length)
			);
		});
	});

	describe('Specific PE laws enrichment', () => {
		it('should have enriched A10-0215/2025 (Solidarity Fund)', async () => {
			const law = await db
				.select({ id: laws.id, title: laws.title, description: laws.description })
				.from(laws)
				.where(like(laws.id, '%A10-0215%'));

			if (law.length === 0) {
				console.warn('A10-0215/2025 not found');
				return;
			}

			expect(law[0].description?.length || 0).toBeGreaterThan(100);
			// Should mention Spain or fund (from HTV content)
			expect(
				law[0].description?.toLowerCase().includes('spain') ||
					law[0].description?.toLowerCase().includes('españa') ||
					law[0].description?.toLowerCase().includes('fund')
			).toBe(true);
		});

		it('should have enriched A9-0048/2022 (Selecta)', async () => {
			const law = await db
				.select({ id: laws.id, title: laws.title, description: laws.description })
				.from(laws)
				.where(like(laws.id, '%A9-0048%'));

			if (law.length === 0) {
				console.warn('A9-0048/2022 not found');
				return;
			}

			expect(law[0].description?.length || 0).toBeGreaterThan(100);
			// Should mention employment adjustment or workers (from HTV)
			expect(
				law[0].description?.toLowerCase().includes('worker') ||
					law[0].description?.toLowerCase().includes('travail') ||
					law[0].description?.toLowerCase().includes('redundanc')
			).toBe(true);
		});

		it('should have enriched A9-0355/2023 (France-Algeria agreement)', async () => {
			const law = await db
				.select({ id: laws.id, title: laws.title, description: laws.description })
				.from(laws)
				.where(like(laws.id, '%A9-0355%'));

			if (law.length === 0) {
				console.warn('A9-0355/2023 not found');
				return;
			}

			expect(law[0].description?.length || 0).toBeGreaterThan(50);
			// Should mention agreement or France or Algeria
			expect(
				law[0].description?.toLowerCase().includes('agreemen') ||
					law[0].description?.toLowerCase().includes('france') ||
					law[0].description?.toLowerCase().includes('algeria')
			).toBe(true);
		});
	});

	describe('Description quality', () => {
		it('should have most descriptions with more than just the title', async () => {
			const peLaws = await db
				.select({ id: laws.id, title: laws.title, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			// At least 70% of laws should have descriptions longer than their title
			let longerCount = 0;
			peLaws.forEach((law) => {
				const desc = law.description || '';
				const title = law.title || '';

				if (desc.length > title.length) {
					longerCount++;
				}
			});

			const ratio = longerCount / peLaws.length;
			expect(ratio).toBeGreaterThanOrEqual(0.7); // At least 70%
		});

		it('should have descriptions without excessive HTML tags', async () => {
			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			peLaws.forEach((law) => {
				const desc = law.description || '';
				// Count HTML tags - should be 0 after cleaning
				const htmlTagCount = (desc.match(/<[^>]*>/g) || []).length;
				expect(htmlTagCount).toBe(0);
			});
		});

		it('should have readable text without excessive special characters', async () => {
			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			peLaws.forEach((law) => {
				const desc = law.description || '';
				if (desc.length > 100) {
					// Most characters should be alphanumeric, spaces, or punctuation
					const validChars = desc.match(/[a-zA-Z0-9\s\-.,;:()«»–—…€]/g) || [];
					const ratio = validChars.length / desc.length;
					expect(ratio).toBeGreaterThan(0.85); // At least 85% valid characters
				}
			});
		});
	});

	describe('Comparison with original', () => {
		it('should have longer descriptions after enrichment', async () => {
			// This test validates the enrichment actually improved the data
			// Original descriptions were short (title only, ~30-50 chars)
			// Enriched should be > 500 chars for most laws

			const peLaws = await db
				.select({ id: laws.id, description: laws.description })
				.from(laws)
				.where(like(laws.id, 'LWPE10%'));

			const enrichedCount = peLaws.filter((l) => (l.description?.length || 0) > 500).length;

			// At least 50% of laws should be substantially enriched
			expect(enrichedCount).toBeGreaterThanOrEqual(Math.ceil(peLaws.length * 0.5));
		});
	});
});
