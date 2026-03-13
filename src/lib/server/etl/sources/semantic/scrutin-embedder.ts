/**
 * Génère des embeddings pour les scrutins et calcule leurs voisins sémantiques.
 *
 * Utilisé UNIQUEMENT en ETL (machine de développement).
 * NE PAS importer depuis le code SvelteKit de production.
 *
 * Prérequis:
 *   npm install --save-dev @huggingface/transformers
 *   (devDependency uniquement — non bundlé en production)
 */

import { db } from '../../../db';
import { scrutins, scrutinSimilar } from '../../../db/schema';
import { sql } from 'drizzle-orm';

/** Modèle d'embedding utilisé. Doit être identique pour tous les runs. */
export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-small';

/** Nombre de voisins à conserver par scrutin. */
export const DEFAULT_NEIGHBORS = 10;

/** Score minimum pour qu'une paire soit conservée. */
export const DEFAULT_THRESHOLD = 0.8;

/**
 * Calcule la similarité cosine entre deux vecteurs.
 * Retourne une valeur entre 0 (orthogonaux) et 1 (identiques).
 *
 * @param a - Premier vecteur (Float32Array de même longueur que b)
 * @param b - Second vecteur
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	if (normA === 0 || normB === 0) return 0;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Pour chaque scrutin, trouve ses N voisins les plus proches parmi tous les embeddings.
 * Relation symétrique : si A→B avec score 0.9, insère aussi B→A avec score 0.9.
 *
 * @param ids - Identifiants des scrutins (même ordre que embeddings)
 * @param embeddings - Vecteurs d'embedding (même ordre que ids)
 * @param neighbors - Nombre de voisins à conserver par scrutin
 * @param threshold - Score minimum pour qu'une paire soit conservée
 * @returns Paires (scrutinId, similarId, score) à insérer dans scrutin_similar
 */
export function computeTopNeighbors(
	ids: string[],
	embeddings: Float32Array[],
	neighbors = DEFAULT_NEIGHBORS,
	threshold = DEFAULT_THRESHOLD
): Array<{ scrutinId: string; similarId: string; score: number }> {
	const n = ids.length;
	// Pour chaque scrutin i, liste des (score, j) candidats
	const candidatesPerScrutin: Array<Array<{ score: number; j: number }>> = Array.from(
		{ length: n },
		() => []
	);

	// Calcul pairwise O(N²/2) — acceptable offline (20K × 20K / 2 = 200M ops)
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const score = cosineSimilarity(embeddings[i], embeddings[j]);
			if (score >= threshold) {
				candidatesPerScrutin[i].push({ score, j });
				candidatesPerScrutin[j].push({ score, j: i });
			}
		}
	}

	const results: Array<{ scrutinId: string; similarId: string; score: number }> = [];

	for (let i = 0; i < n; i++) {
		// Trier par score décroissant et garder les N meilleurs
		const top = candidatesPerScrutin[i].sort((a, b) => b.score - a.score).slice(0, neighbors);

		for (const { score, j } of top) {
			results.push({
				scrutinId: ids[i],
				similarId: ids[j],
				score: Math.round(score * 10000) / 10000 // 4 décimales
			});
		}
	}

	return results;
}

/**
 * Retourne les scrutins qui n'ont pas encore d'entrées dans scrutin_similar.
 * Utilisé pour les re-runs incrémentaux.
 */
export async function getScrutinsWithoutNeighbors(limit: number) {
	return db
		.select({ id: scrutins.id, title: scrutins.title, description: scrutins.description })
		.from(scrutins)
		.where(sql`${scrutins.id} NOT IN (SELECT DISTINCT scrutin_id FROM scrutin_similar)`)
		.limit(limit);
}

/**
 * Insère les paires de voisins en base par batch.
 * Ignore les doublons (ON CONFLICT DO NOTHING).
 *
 * @param pairs - Paires à insérer
 * @param batchSize - Taille des batches d'insertion
 */
export async function saveSimilarScrutins(
	pairs: Array<{ scrutinId: string; similarId: string; score: number }>,
	batchSize = 500
): Promise<number> {
	if (pairs.length === 0) return 0;
	let inserted = 0;
	for (let i = 0; i < pairs.length; i += batchSize) {
		const batch = pairs.slice(i, i + batchSize);
		await db.insert(scrutinSimilar).values(batch).onConflictDoNothing();
		inserted += batch.length;
	}
	return inserted;
}
