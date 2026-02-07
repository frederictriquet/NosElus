import { db, laws } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql } from 'drizzle-orm';
import type { NewLaw } from '../../../db';
import { getCache, setCache, type CacheOptions } from '../../cache';
import { PE_SOURCES, ETL_CONFIG } from '../../config';
import { getCurrentTerm as getCurrentPETerm } from '../../../periods/pe-terms';

const HTV_API_BASE = PE_SOURCES.howTheyVoteApiUrl;
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
 * Fetch data from HowTheyVote API
 */
async function fetchHTV<T>(endpoint: string): Promise<T> {
	const url = `${HTV_API_BASE}${endpoint}`;
	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'NosElus/1.0 (https://noselus.fr)'
		}
	});

	if (!response.ok) {
		throw new Error(`HTV API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get list of votes with French MEPs involved
 */
async function fetchVotesList(page = 1, pageSize = 100): Promise<HTVVoteListResponse> {
	// Filter by France to get votes relevant to French MEPs
	return fetchHTV<HTVVoteListResponse>(
		`/votes?geo_areas=FRA&page=${page}&page_size=${pageSize}&sort_by=timestamp&sort_order=desc`
	);
}

/**
 * Generate law ID for PE laws
 */
function generateLawId(reference: string, term: number): string {
	return `LWPE${term}-${reference.replace(/\//g, '-')}`;
}

/**
 * Map HTV procedure reference to law
 */
function mapToLaw(
	reference: string,
	mainVote: HTVVoteListItem,
	term: number
): NewLaw {
	const id = generateLawId(reference, term);
	const voteDate = mainVote.timestamp.split('T')[0];

	return {
		id,
		uid: `HTV-${reference}`,
		number: reference,
		legislature: `PE-${term}`,
		title: mainVote.display_title || 'Procédure sans titre',
		shortTitle: mainVote.display_title || null,
		type: 'procedure', // Type générique pour PE
		status: mainVote.result === 'ADOPTED' ? 'adopté' : mainVote.result === 'REJECTED' ? 'rejeté' : null,
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

	// Get current term dynamically from database
	const currentTermStr = await getCurrentPETerm();
	const currentTerm = parseInt(currentTermStr, 10);
	console.log(`[EuroParl Laws] Using term ${currentTerm} from database`);

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

	for (const [reference, mainVote] of mainVotesMap) {
		try {
			const law = mapToLaw(reference, mainVote, currentTerm);
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
