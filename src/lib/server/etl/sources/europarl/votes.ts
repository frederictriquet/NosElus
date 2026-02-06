import { db, actors, scrutins, votes, organs } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql, eq, and, inArray } from 'drizzle-orm';
import type { NewScrutin, NewVote } from '../../../db';
import { getCache, setCache, type CacheOptions } from '../../cache';
import { PE_SOURCES, PE_GROUP_CODE_MAP, PE_POSITION_MAP, ETL_CONFIG } from '../../config';
import { getCurrentTerm as getCurrentPETerm } from '../../../periods/pe-terms';

const HTV_API_BASE = PE_SOURCES.howTheyVoteApiUrl;
const CACHE_KEY_PREFIX = 'htv_votes';
const CACHE_OPTIONS: CacheOptions = { ttlHours: ETL_CONFIG.cacheTtl.votes };

// Position and group mappings imported from config
const POSITION_MAP = PE_POSITION_MAP;
const HTV_GROUP_CODE_MAP = PE_GROUP_CODE_MAP;

interface HTVMember {
	id: number;
	first_name: string;
	last_name: string;
	country: { code: string; label: string };
	group: { code: string; label: string } | null;
	photo_url: string | null;
}

interface HTVMemberVote {
	member: HTVMember;
	position: 'FOR' | 'AGAINST' | 'ABSTENTION' | 'DID_NOT_VOTE';
}

interface HTVVoteCounts {
	FOR: number;
	AGAINST: number;
	ABSTENTION: number;
	DID_NOT_VOTE: number;
}

interface HTVVoteStats {
	total: HTVVoteCounts;
	by_group: Array<{
		group: { code: string; label: string; short_label: string };
		stats: HTVVoteCounts;
	}>;
}

interface HTVVote {
	id: string;
	timestamp: string;
	display_title: string;
	description: string | null;
	reference: string | null;
	result: 'ADOPTED' | 'REJECTED' | null;
	stats: HTVVoteStats;
	member_votes: HTVMemberVote[];
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
 * Get detailed vote with member votes
 */
async function fetchVoteDetails(voteId: string): Promise<HTVVote> {
	// Check cache first
	const cacheKey = `${CACHE_KEY_PREFIX}_${voteId}`;
	const cached = await getCache<HTVVote>(cacheKey, CACHE_OPTIONS);
	if (cached) {
		return cached;
	}

	const vote = await fetchHTV<HTVVote>(`/votes/${voteId}`);

	// Cache the result
	await setCache(cacheKey, vote, CACHE_OPTIONS);

	return vote;
}

/**
 * Generate scrutin ID for PE votes
 */
function generateScrutinId(voteId: string, term: number): string {
	return `VTPE${term}-${voteId}`;
}

/**
 * Generate vote ID
 */
function generateVoteId(scrutinId: string, actorId: string): string {
	return `${scrutinId}_${actorId}`;
}

/**
 * Build group results from HTV stats.by_group
 */
function buildGroupResults(
	byGroup: HTVVoteStats['by_group'],
	groupIdMap: Map<string, string>
): Record<string, { pour: number; contre: number; abstention: number; nonVotant: number }> | null {
	if (!byGroup || byGroup.length === 0) return null;

	const results: Record<
		string,
		{ pour: number; contre: number; abstention: number; nonVotant: number }
	> = {};

	for (const groupStat of byGroup) {
		// Map HTV group code to our group ID
		const htvCode = groupStat.group.code;
		const ourShortName = HTV_GROUP_CODE_MAP[htvCode] || htvCode;
		const groupId = groupIdMap.get(ourShortName);

		if (!groupId) continue; // Skip groups we don't have in DB

		results[groupId] = {
			pour: groupStat.stats.FOR,
			contre: groupStat.stats.AGAINST,
			abstention: groupStat.stats.ABSTENTION,
			nonVotant: groupStat.stats.DID_NOT_VOTE
		};
	}

	return Object.keys(results).length > 0 ? results : null;
}

/**
 * Generate law ID for PE laws (must match europarl/laws.ts format)
 */
function generateLawId(reference: string, term: number): string {
	return `LWPE${term}-${reference.replace(/\//g, '-')}`;
}

/**
 * Map HTV vote to scrutin
 */
function mapToScrutin(
	vote: HTVVote,
	term: number,
	groupIdMap: Map<string, string>
): NewScrutin {
	const id = generateScrutinId(vote.id, term);
	const date = vote.timestamp.split('T')[0];
	const totals = vote.stats.total;

	// Calculate total voters from the counts
	const totalVoters = totals.FOR + totals.AGAINST + totals.ABSTENTION + totals.DID_NOT_VOTE;

	// Build group results from stats.by_group
	const groupResults = buildGroupResults(vote.stats.by_group, groupIdMap);

	// Link to law if vote has a procedure reference
	const lawId = vote.reference ? generateLawId(vote.reference, term) : null;

	return {
		id,
		uid: `HTV-${vote.id}`,
		number: parseInt(vote.id, 10) || 0,
		legislature: `PE-${term}`,
		date,
		title: vote.display_title || 'Vote sans titre',
		type: 'PLN', // Plénière
		totalVoters,
		totalFor: totals.FOR,
		totalAgainst: totals.AGAINST,
		totalAbstention: totals.ABSTENTION,
		totalNonVoting: totals.DID_NOT_VOTE,
		result: vote.result === 'ADOPTED' ? 'adopté' : vote.result === 'REJECTED' ? 'rejeté' : null,
		description: vote.description || null,
		groupResults,
		lawId
	};
}

/**
 * Import votes from HowTheyVote.eu
 */
export async function importEuroparlVotes(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[EuroParl Votes] Starting import from HowTheyVote.eu...');

	// Get current term dynamically from database
	const currentTermStr = await getCurrentPETerm();
	const currentTerm = parseInt(currentTermStr, 10);
	console.log(`[EuroParl Votes] Using term ${currentTerm} from database`);

	// Get French MEP IDs from database
	const frenchMeps = await db
		.select({ id: actors.id, uid: actors.uid })
		.from(actors)
		.where(eq(actors.chamber, 'PE'));

	if (frenchMeps.length === 0) {
		console.log('[EuroParl Votes] No French MEPs found in database. Run etl-europarl-meps first.');
		return stats;
	}

	// Create a map of ParlTrack UserID to our actor ID
	const mepIdMap = new Map<number, string>();
	for (const mep of frenchMeps) {
		if (mep.uid) {
			mepIdMap.set(parseInt(mep.uid, 10), mep.id);
		}
	}
	console.log(`[EuroParl Votes] Found ${mepIdMap.size} French MEPs in database`);

	// Get group ID mapping from database (to avoid hardcoding)
	const peGroups = await db
		.select({ id: organs.id, shortName: organs.shortName })
		.from(organs)
		.where(and(eq(organs.chamber, 'PE'), eq(organs.type, 'GP')));

	const groupIdMap = new Map<string, string>();
	for (const group of peGroups) {
		if (group.shortName) {
			groupIdMap.set(group.shortName, group.id);
		}
	}
	console.log(`[EuroParl Votes] Found ${groupIdMap.size} PE groups in database`);

	// Fetch votes list
	let page = 1;
	let hasMore = true;
	const allVotes: HTVVoteListItem[] = [];
	const maxPages = config.incremental ? 5 : 50; // Limit pages for incremental

	while (hasMore && page <= maxPages) {
		console.log(`[EuroParl Votes] Fetching page ${page}...`);

		try {
			const response = await fetchVotesList(page, 100);
			allVotes.push(...response.results);
			hasMore = response.has_next;
			page++;

			// Rate limiting
			await new Promise((resolve) => setTimeout(resolve, 200));
		} catch (error) {
			console.error(`[EuroParl Votes] Error fetching page ${page}:`, error);
			break;
		}
	}

	console.log(`[EuroParl Votes] Found ${allVotes.length} votes to process`);
	stats.total = allVotes.length;

	// Process votes in batches
	const scrutinBatch: NewScrutin[] = [];
	const voteBatch: NewVote[] = [];

	for (let i = 0; i < allVotes.length; i++) {
		const voteItem = allVotes[i];

		try {
			// Fetch detailed vote
			const voteDetails = await fetchVoteDetails(voteItem.id);

			// Map to scrutin (with group results)
			const scrutin = mapToScrutin(voteDetails, currentTerm, groupIdMap);
			scrutinBatch.push(scrutin);

			// Extract French MEP votes only
			for (const memberVote of voteDetails.member_votes) {
				// Check if this MEP is French and in our database
				const actorId = mepIdMap.get(memberVote.member.id);
				if (!actorId) continue;

				// Get group ID from our database using the HTV code mapping
				let groupId: string | null = null;
				if (memberVote.member.group) {
					const htvCode = memberVote.member.group.code;
					const ourShortName = HTV_GROUP_CODE_MAP[htvCode] || htvCode;
					groupId = groupIdMap.get(ourShortName) || null;
				}

				voteBatch.push({
					id: generateVoteId(scrutin.id, actorId),
					scrutinId: scrutin.id,
					actorId,
					groupId,
					position: POSITION_MAP[memberVote.position] || 'non-votant'
				});
			}

			stats.inserted++;

			// Rate limiting between requests
			if (i % 10 === 0) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		} catch (error) {
			console.error(`[EuroParl Votes] Error processing vote ${voteItem.id}:`, error);
			stats.errors++;
		}

		if ((i + 1) % 50 === 0 || i === allVotes.length - 1) {
			logProgress(stats, 'EuroParl Votes');
		}
	}

	// Insert scrutins
	if (scrutinBatch.length > 0) {
		console.log(`[EuroParl Votes] Inserting ${scrutinBatch.length} scrutins...`);

		for (let i = 0; i < scrutinBatch.length; i += config.batchSize) {
			const batch = scrutinBatch.slice(i, i + config.batchSize);

			try {
				await db
					.insert(scrutins)
					.values(batch)
					.onConflictDoUpdate({
						target: scrutins.id,
						set: {
							title: sql`excluded.title`,
							totalVoters: sql`excluded.total_voters`,
							totalFor: sql`excluded.total_for`,
							totalAgainst: sql`excluded.total_against`,
							totalAbstention: sql`excluded.total_abstention`,
							totalNonVoting: sql`excluded.total_non_voting`,
							result: sql`excluded.result`,
							groupResults: sql`excluded.group_results`,
							lawId: sql`excluded.law_id`,
							updatedAt: sql`now()`
						}
					});
			} catch (error) {
				console.error(`[EuroParl Votes] Error inserting scrutins batch:`, error);
			}
		}
	}

	// Insert votes
	if (voteBatch.length > 0) {
		console.log(`[EuroParl Votes] Inserting ${voteBatch.length} individual votes...`);

		for (let i = 0; i < voteBatch.length; i += config.batchSize) {
			const batch = voteBatch.slice(i, i + config.batchSize);

			try {
				await db
					.insert(votes)
					.values(batch)
					.onConflictDoUpdate({
						target: votes.id,
						set: {
							position: sql`excluded.position`,
							groupId: sql`excluded.group_id`
						}
					});
			} catch (error) {
				console.error(`[EuroParl Votes] Error inserting votes batch:`, error);
			}
		}
	}

	console.log(
		`[EuroParl Votes] Import complete: ${stats.inserted} votes processed, ${voteBatch.length} individual votes, ${stats.errors} errors`
	);

	return stats;
}
