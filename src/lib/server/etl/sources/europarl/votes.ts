import { db, actors, scrutins, votes, organs } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql, eq, and, inArray } from 'drizzle-orm';
import type { NewScrutin, NewVote } from '../../../db';
import { getCache, setCache, type CacheOptions } from '../../cache';

const HTV_API_BASE = 'https://howtheyvote.eu/api';
const CACHE_KEY_PREFIX = 'htv_votes';
const CACHE_OPTIONS: CacheOptions = { ttlHours: 6 };

// Current parliamentary term
const CURRENT_TERM = 10;

// Position mapping from HowTheyVote to our schema
const POSITION_MAP: Record<string, string> = {
	FOR: 'pour',
	AGAINST: 'contre',
	ABSTENTION: 'abstention',
	DID_NOT_VOTE: 'non-votant'
};

// Mapping HowTheyVote group codes to our database shortNames
// This is necessary because HTV uses different codes than ParlTrack/our DB
const HTV_GROUP_CODE_MAP: Record<string, string> = {
	EPP: 'PPE', // European People's Party
	SD: 'S&D', // Socialists & Democrats
	RENEW: 'RE', // Renew Europe
	GREEN_EFA: 'Verts/ALE', // Greens/EFA
	GUE_NGL: 'GUE/NGL', // The Left
	ECR: 'ECR', // European Conservatives and Reformists
	PFE: 'Patriots for Europe Group', // Patriots for Europe
	ESN: 'Europe of Sovereign Nations Group', // Europe of Sovereign Nations
	NI: 'NA' // Non-attached
};

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
function generateScrutinId(voteId: string): string {
	return `VTPE${CURRENT_TERM}-${voteId}`;
}

/**
 * Generate vote ID
 */
function generateVoteId(scrutinId: string, actorId: string): string {
	return `${scrutinId}_${actorId}`;
}

/**
 * Map HTV vote to scrutin
 */
function mapToScrutin(vote: HTVVote): NewScrutin {
	const id = generateScrutinId(vote.id);
	const date = vote.timestamp.split('T')[0];
	const totals = vote.stats.total;

	// Calculate total voters from the counts
	const totalVoters = totals.FOR + totals.AGAINST + totals.ABSTENTION + totals.DID_NOT_VOTE;

	return {
		id,
		uid: `HTV-${vote.id}`,
		number: parseInt(vote.id, 10) || 0,
		legislature: `PE-${CURRENT_TERM}`,
		date,
		title: vote.display_title || 'Vote sans titre',
		type: 'PLN', // Plénière
		totalVoters,
		totalFor: totals.FOR,
		totalAgainst: totals.AGAINST,
		totalAbstention: totals.ABSTENTION,
		totalNonVoting: totals.DID_NOT_VOTE,
		result: vote.result === 'ADOPTED' ? 'adopté' : vote.result === 'REJECTED' ? 'rejeté' : null,
		description: vote.description || null
	};
}

/**
 * Import votes from HowTheyVote.eu
 */
export async function importEuroparlVotes(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[EuroParl Votes] Starting import from HowTheyVote.eu...');

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

			// Map to scrutin
			const scrutin = mapToScrutin(voteDetails);
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
