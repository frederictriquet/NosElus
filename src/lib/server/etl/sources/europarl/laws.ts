import { db, laws } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';
import type { NewLaw } from '../../../db';
import { getCache, setCache, type CacheOptions } from '../../cache';
import { ETL_CONFIG } from '../../config';
import { getCurrentTerm as getCurrentPETerm } from '../../../periods/pe-terms';
// Fonctions partagées entre modules PE ETL pour garantir la cohérence des IDs de lois
import { generateLawId, extractTermFromReference, fetchHTV } from './shared';

const CACHE_KEY_PREFIX = 'htv_procedures';
const CACHE_OPTIONS: CacheOptions = { ttlHours: ETL_CONFIG.cacheTtl.laws };

interface HTVProcedure {
	id: string;
	reference: string;
	title: string;
	description: string | null;
}

interface HTVVoteListItem {
	id: string;
	is_main: boolean;
	timestamp: string;
	display_title: string;
	description: string | null;
	reference: string | null;
	result: 'ADOPTED' | 'REJECTED' | null;
}

interface HTVVoteListResponse {
	total: number;
	page: number;
	page_size: number;
	has_next: boolean;
	results: HTVVoteListItem[];
}

/**
 * Get paginated list of all EP plenary votes from HowTheyVote.eu
 */
async function fetchVotesList(page = 1, pageSize = 100): Promise<HTVVoteListResponse> {
	return fetchHTV<HTVVoteListResponse>(
		`/votes?page=${page}&page_size=${pageSize}&sort_by=timestamp&sort_order=desc`
	);
}

/**
 * Map HTV procedure reference to law
 */
function mapToLaw(reference: string, mainVote: HTVVoteListItem, term: number): NewLaw {
	const id = generateLawId(reference, term);
	const voteDate = mainVote.timestamp.split('T')[0];
	const displayTitle = mainVote.display_title || 'Procédure sans titre';

	return {
		id,
		uid: `HTV-${reference}`,
		number: reference,
		legislature: `PE-${term}`,
		title: displayTitle,
		shortTitle:
			displayTitle.length > 300
				? displayTitle.slice(0, 297).replace(/\s+\S*$/, '') + '...'
				: displayTitle,
		type: 'procedure', // Type générique pour PE
		status:
			mainVote.result === 'ADOPTED' ? 'adopté' : mainVote.result === 'REJECTED' ? 'rejeté' : null,
		// Use main vote date as deposit date (PE procedures don't have clear deposit dates)
		depositDate: voteDate,
		description: mainVote.description || null,
		sourceUrl: null // HowTheyVote ne fournit pas d'URL vers le texte
	};
}

/**
 * Import laws from HowTheyVote.eu
 *
 * Extrait les procédures législatives depuis les votes principaux (is_main=true)
 * ayant une référence de procédure.
 */
export async function importEuroparlLaws(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[EuroParl Laws] Starting import from HowTheyVote.eu...');

	// Get current term as fallback for references without extractable term
	const currentTermStr = await getCurrentPETerm();
	const fallbackTerm = parseInt(currentTermStr, 10);
	console.log(`[EuroParl Laws] Fallback term: ${fallbackTerm}`);

	// Fetch votes list and filter for main votes with procedure reference
	let page = 1;
	let hasMore = true;
	const mainVotesMap = new Map<string, HTVVoteListItem>(); // reference → main vote
	const maxPages = config.incremental ? 5 : 50;

	while (hasMore && page <= maxPages) {
		console.log(`[EuroParl Laws] Fetching page ${page}...`);

		try {
			const response = await fetchVotesList(page, 100);

			for (const vote of response.results) {
				// Filter for main votes with procedure reference
				if (vote.is_main && vote.reference) {
					// Keep only the most recent main vote per procedure
					if (!mainVotesMap.has(vote.reference)) {
						mainVotesMap.set(vote.reference, vote);
					}
				}
			}

			hasMore = response.has_next;
			page++;

			// Rate limiting
			await new Promise((resolve) => setTimeout(resolve, 200));
		} catch (error) {
			console.error(`[EuroParl Laws] Error fetching page ${page}:`, error);
			break;
		}
	}

	console.log(`[EuroParl Laws] Found ${mainVotesMap.size} procedures to process`);
	stats.total = mainVotesMap.size;

	// Process procedures in batches
	const lawBatch: NewLaw[] = [];
	const termCounts = new Map<number, number>();

	for (const [reference, mainVote] of mainVotesMap) {
		try {
			const term = extractTermFromReference(reference) ?? fallbackTerm;
			termCounts.set(term, (termCounts.get(term) ?? 0) + 1);

			const law = mapToLaw(reference, mainVote, term);
			lawBatch.push(law);
			stats.inserted++;
		} catch (error) {
			console.error(`[EuroParl Laws] Error processing procedure ${reference}:`, error);
			stats.errors++;
		}

		if (lawBatch.length % 50 === 0 || lawBatch.length === mainVotesMap.size) {
			logProgress(stats, 'EuroParl Laws');
		}
	}

	// Log term distribution
	for (const [term, count] of [...termCounts.entries()].sort((a, b) => a[0] - b[0])) {
		console.log(`[EuroParl Laws] Term ${term}: ${count} procedures`);
	}

	// Insert laws
	if (lawBatch.length > 0) {
		console.log(`[EuroParl Laws] Inserting ${lawBatch.length} laws...`);

		for (let i = 0; i < lawBatch.length; i += config.batchSize) {
			const batch = lawBatch.slice(i, i + config.batchSize);

			try {
				await db
					.insert(laws)
					.values(batch)
					.onConflictDoUpdate({
						target: laws.id,
						set: {
							title: sql`excluded.title`,
							shortTitle: sql`excluded.short_title`,
							description: sql`excluded.description`,
							status: sql`excluded.status`,
							updatedAt: sql`now()`
						}
					});
			} catch (error) {
				console.error(`[EuroParl Laws] Error inserting laws batch:`, error);
			}
		}
	}

	console.log(
		`[EuroParl Laws] Import complete: ${stats.inserted} laws processed, ${stats.errors} errors`
	);

	return stats;
}
