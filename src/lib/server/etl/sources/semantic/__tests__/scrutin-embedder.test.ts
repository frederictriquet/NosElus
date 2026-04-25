/**
 * Tests unitaires pour scrutin-embedder.ts
 *
 * cosineSimilarity() et computeTopNeighbors() sont des fonctions pures testées ici.
 * Les fonctions DB (getScrutinsWithoutNeighbors, saveSimilarScrutins) nécessitent
 * une connexion réelle et sont couvertes par des tests d'intégration séparés.
 */

import { describe, it, expect } from 'vitest';
import { cosineSimilarity, computeTopNeighbors } from '../scrutin-embedder';

// ============================================================
// Helpers
// ============================================================

function vec(values: number[]): Float32Array {
	return new Float32Array(values);
}

// ============================================================
// cosineSimilarity
// ============================================================

describe('cosineSimilarity', () => {
	it('should return 1.0 for identical vectors', () => {
		const a = vec([1, 0, 0]);
		const b = vec([1, 0, 0]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 6);
	});

	it('should return 1.0 for parallel vectors with different magnitudes', () => {
		const a = vec([1, 2, 3]);
		const b = vec([2, 4, 6]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 6);
	});

	it('should return 0.0 for orthogonal vectors', () => {
		const a = vec([1, 0, 0]);
		const b = vec([0, 1, 0]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 6);
	});

	it('should return -1.0 for opposite vectors', () => {
		const a = vec([1, 0, 0]);
		const b = vec([-1, 0, 0]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 6);
	});

	it('should return 0.0 for zero vector a', () => {
		const a = vec([0, 0, 0]);
		const b = vec([1, 2, 3]);
		expect(cosineSimilarity(a, b)).toBe(0);
	});

	it('should return 0.0 for zero vector b', () => {
		const a = vec([1, 2, 3]);
		const b = vec([0, 0, 0]);
		expect(cosineSimilarity(a, b)).toBe(0);
	});

	it('should return 0.0 for two zero vectors', () => {
		const a = vec([0, 0, 0]);
		const b = vec([0, 0, 0]);
		expect(cosineSimilarity(a, b)).toBe(0);
	});

	it('should compute correct similarity for 45° angle', () => {
		// [1,0] and [1,1]/√2 → cos(45°) = 1/√2 ≈ 0.707
		const a = vec([1, 0]);
		const b = vec([1, 1]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(Math.SQRT1_2, 5);
	});

	it('should be symmetric: sim(a,b) === sim(b,a)', () => {
		const a = vec([0.3, 0.7, 0.1]);
		const b = vec([0.5, 0.2, 0.9]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
	});

	it('should work with higher-dimension vectors (384 dims)', () => {
		const dim = 384;
		const a = new Float32Array(dim).fill(1 / Math.sqrt(dim));
		const b = new Float32Array(dim).fill(1 / Math.sqrt(dim));
		expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
	});

	it('should return value in [-1, 1] range', () => {
		const a = vec([0.1, -0.5, 0.8, 0.3]);
		const b = vec([-0.2, 0.7, 0.4, -0.1]);
		const sim = cosineSimilarity(a, b);
		expect(sim).toBeGreaterThanOrEqual(-1);
		expect(sim).toBeLessThanOrEqual(1);
	});
});

// ============================================================
// computeTopNeighbors
// ============================================================

describe('computeTopNeighbors', () => {
	it('should return empty array when given 0 scrutins', () => {
		const result = computeTopNeighbors([], [], 10, 0.8);
		expect(result).toEqual([]);
	});

	it('should return empty array when given 1 scrutin', () => {
		const result = computeTopNeighbors(['A'], [vec([1, 0, 0])], 10, 0.8);
		expect(result).toEqual([]);
	});

	it('should detect similar pair above threshold', () => {
		// A et B sont quasiment identiques → score ≈ 1.0
		const ids = ['A', 'B'];
		const embeddings = [vec([1, 0, 0]), vec([1, 0, 0])];
		const result = computeTopNeighbors(ids, embeddings, 10, 0.8);

		expect(result).toHaveLength(2); // A→B et B→A
		const ab = result.find((r) => r.scrutinId === 'A' && r.similarId === 'B');
		const ba = result.find((r) => r.scrutinId === 'B' && r.similarId === 'A');
		expect(ab).toBeDefined();
		expect(ba).toBeDefined();
		expect(ab!.score).toBeCloseTo(1.0, 3);
		expect(ba!.score).toBeCloseTo(1.0, 3);
	});

	it('should filter out pair below threshold', () => {
		// A et B sont orthogonaux → score = 0 < 0.8
		const ids = ['A', 'B'];
		const embeddings = [vec([1, 0, 0]), vec([0, 1, 0])];
		const result = computeTopNeighbors(ids, embeddings, 10, 0.8);

		expect(result).toEqual([]);
	});

	it('should be symmetric: A→B implies B→A with same score', () => {
		const ids = ['A', 'B', 'C'];
		// A et B similaires, C orthogonal
		const embeddings = [vec([1, 0, 0]), vec([1, 0.1, 0]), vec([0, 0, 1])];
		const result = computeTopNeighbors(ids, embeddings, 10, 0.5);

		const ab = result.find((r) => r.scrutinId === 'A' && r.similarId === 'B');
		const ba = result.find((r) => r.scrutinId === 'B' && r.similarId === 'A');
		expect(ab).toBeDefined();
		expect(ba).toBeDefined();
		expect(ab!.score).toBeCloseTo(ba!.score, 6);
	});

	it('should respect neighbors limit', () => {
		// 5 scrutins quasi-identiques, on demande max 2 voisins par scrutin
		const n = 5;
		const ids = Array.from({ length: n }, (_, i) => `S${i}`);
		const embeddings = ids.map(() => vec([1, 0, 0]));
		const result = computeTopNeighbors(ids, embeddings, 2, 0.0);

		// Chaque scrutin a au plus 2 voisins
		for (const id of ids) {
			const neighbors = result.filter((r) => r.scrutinId === id);
			expect(neighbors.length).toBeLessThanOrEqual(2);
		}
	});

	it('should keep top-N neighbors sorted by descending score', () => {
		// S0 similaire à S1 (score≈1) et moins similaire à S2 (score≈0.7)
		const ids = ['S0', 'S1', 'S2'];
		const embeddings = [
			vec([1, 0, 0]), // S0
			vec([1, 0.01, 0]), // S1 — très proche de S0
			vec([0.7, 0.714, 0]) // S2 — à environ 45° de S0
		];
		const result = computeTopNeighbors(ids, embeddings, 1, 0.0);

		// S0 ne doit garder que son meilleur voisin : S1
		const s0neighbors = result.filter((r) => r.scrutinId === 'S0');
		expect(s0neighbors).toHaveLength(1);
		expect(s0neighbors[0].similarId).toBe('S1');
	});

	it('should round score to 4 decimal places', () => {
		const ids = ['A', 'B'];
		const embeddings = [vec([1, 2, 3]), vec([2, 3, 4])];
		const result = computeTopNeighbors(ids, embeddings, 10, 0.0);

		for (const pair of result) {
			// 4 décimales max : score * 10000 doit être entier
			expect(pair.score * 10000).toBeCloseTo(Math.round(pair.score * 10000), 6);
		}
	});

	it('should not produce self-pairs (A→A)', () => {
		const ids = ['A', 'B', 'C'];
		const embeddings = [vec([1, 0, 0]), vec([1, 0, 0]), vec([1, 0, 0])];
		const result = computeTopNeighbors(ids, embeddings, 10, 0.0);

		const selfPairs = result.filter((r) => r.scrutinId === r.similarId);
		expect(selfPairs).toHaveLength(0);
	});

	it('should return correct scrutinId and similarId from original ids', () => {
		const ids = ['VTANR001', 'VTANR002'];
		const embeddings = [vec([1, 0, 0]), vec([1, 0, 0])];
		const result = computeTopNeighbors(ids, embeddings, 10, 0.8);

		const ab = result.find((r) => r.scrutinId === 'VTANR001');
		expect(ab).toBeDefined();
		expect(ab!.similarId).toBe('VTANR002');
	});

	it('should handle threshold=0 and return all pairs', () => {
		// Avec threshold=0, toutes les paires non-auto-similaires doivent être incluses
		const ids = ['A', 'B', 'C'];
		const embeddings = [vec([1, 0, 0]), vec([0, 1, 0]), vec([0, 0, 1])];
		const result = computeTopNeighbors(ids, embeddings, 10, 0.0);

		// 3 paires orthogonales, score=0 >= 0 → incluses (si la condition est >=)
		// Avec les orthogonaux (score=0) et threshold=0.0: score >= threshold donc inclus
		// A→B, A→C, B→A, B→C, C→A, C→B = 6 entrées
		expect(result).toHaveLength(6);
	});

	it('should handle threshold=1.0 and only return identical vectors', () => {
		const ids = ['A', 'B', 'C'];
		const embeddings = [
			vec([1, 0, 0]), // A
			vec([1, 0, 0]), // B — identique à A
			vec([0, 1, 0]) // C — différent
		];
		const result = computeTopNeighbors(ids, embeddings, 10, 1.0);

		// Seules A↔B passent (score=1.0)
		expect(result).toHaveLength(2);
		const ids_found = result.map((r) => r.scrutinId).sort();
		expect(ids_found).toEqual(['A', 'B']);
	});
});
