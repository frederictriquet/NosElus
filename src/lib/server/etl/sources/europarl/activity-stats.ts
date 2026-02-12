import { db, actors, actorStats } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress, actorStatsUpsertConfig } from '../../utils';
import { eq, and } from 'drizzle-orm';
import type { NewActorStats } from '../../../db';

const HOWTHEYVOTE_API_BASE = 'https://howtheyvote.eu/api';

interface HowTheyVoteMember {
	id: number;
	first_name: string;
	last_name: string;
	full_name: string;
	country: {
		code: string;
		iso_alpha_2: string;
		label: string;
	};
	group: {
		code: string;
		label: string;
		short_label: string;
	};
	terms: number[];
}

interface HowTheyVoteVote {
	id: string;
	position: 'FOR' | 'AGAINST' | 'ABSTENTION' | 'DID_NOT_VOTE';
	timestamp: string;
	display_title: string;
}

interface HowTheyVoteVotesResponse {
	total: number;
	page: number;
	page_size: number;
	has_prev: boolean;
	has_next: boolean;
	results: HowTheyVoteVote[];
}

interface AggregatedVoteStats {
	totalVotes: number;
	votesFor: number;
	votesAgainst: number;
	abstentions: number;
	didNotVote: number;
}

/**
 * Fetch vote statistics for a MEP from HowTheyVote API
 */
async function fetchMepVoteStats(mepId: number): Promise<AggregatedVoteStats | null> {
	const stats: AggregatedVoteStats = {
		totalVotes: 0,
		votesFor: 0,
		votesAgainst: 0,
		abstentions: 0,
		didNotVote: 0
	};

	try {
		// Fetch first page to get total count
		const firstPageUrl = `${HOWTHEYVOTE_API_BASE}/members/${mepId}/votes?page_size=100`;
		const firstResponse = await fetch(firstPageUrl);

		if (!firstResponse.ok) {
			return null;
		}

		const firstData: HowTheyVoteVotesResponse = await firstResponse.json();
		stats.totalVotes = firstData.total;

		// Process first page
		for (const vote of firstData.results) {
			switch (vote.position) {
				case 'FOR':
					stats.votesFor++;
					break;
				case 'AGAINST':
					stats.votesAgainst++;
					break;
				case 'ABSTENTION':
					stats.abstentions++;
					break;
				case 'DID_NOT_VOTE':
					stats.didNotVote++;
					break;
			}
		}

		// Fetch remaining pages if needed (sample first 500 votes for performance)
		let page = 2;
		const maxPages = 5; // Limit to 500 votes for performance
		while (firstData.has_next && page <= maxPages) {
			const pageUrl = `${HOWTHEYVOTE_API_BASE}/members/${mepId}/votes?page=${page}&page_size=100`;
			const pageResponse = await fetch(pageUrl);

			if (!pageResponse.ok) break;

			const pageData: HowTheyVoteVotesResponse = await pageResponse.json();

			for (const vote of pageData.results) {
				switch (vote.position) {
					case 'FOR':
						stats.votesFor++;
						break;
					case 'AGAINST':
						stats.votesAgainst++;
						break;
					case 'ABSTENTION':
						stats.abstentions++;
						break;
					case 'DID_NOT_VOTE':
						stats.didNotVote++;
						break;
				}
			}

			if (!pageData.has_next) break;
			page++;

			// Small delay between requests
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		return stats;
	} catch (error) {
		console.error(`[Europarl Activity Stats] Error fetching votes for MEP ${mepId}:`, error);
		return null;
	}
}

/**
 * Import activity statistics for French MEPs from HowTheyVote.eu
 */
export async function importEuroparlActivityStats(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[Europarl Activity Stats] Fetching French MEPs from database...');

	// Get all French MEPs with their uid (which contains HowTheyVote ID)
	const frenchMeps = await db
		.select({ id: actors.id, uid: actors.uid, fullName: actors.fullName })
		.from(actors)
		.where(eq(actors.chamber, 'PE'));

	console.log(`[Europarl Activity Stats] Found ${frenchMeps.length} French MEPs in database`);
	stats.total = frenchMeps.length;

	const batchSize = config.batchSize;
	const statsToInsert: NewActorStats[] = [];
	let processed = 0;

	for (const mep of frenchMeps) {
		// Extract HowTheyVote ID from uid (format: HTV-123456 or just the number)
		let htvId: number | null = null;

		if (mep.uid) {
			if (mep.uid.startsWith('HTV-')) {
				htvId = parseInt(mep.uid.replace('HTV-', ''), 10);
			} else {
				// Try to parse as number directly
				const parsed = parseInt(mep.uid, 10);
				if (!isNaN(parsed)) {
					htvId = parsed;
				}
			}
		}

		if (!htvId) {
			stats.skipped++;
			processed++;
			continue;
		}

		const voteStats = await fetchMepVoteStats(htvId);

		if (!voteStats || voteStats.totalVotes === 0) {
			stats.skipped++;
			processed++;
			continue;
		}

		// Calculate participation rate (excluding DID_NOT_VOTE from "expressed votes")
		const expressedVotes = voteStats.votesFor + voteStats.votesAgainst + voteStats.abstentions;

		statsToInsert.push({
			actorId: mep.id,
			source: 'howtheyvote',
			// Map vote stats to our schema
			weeksPresent: Math.ceil(voteStats.totalVotes / 10), // Approximate weeks based on ~10 votes/week
			commissionPresences: 0,
			hemicycleInterventions: expressedVotes,
			hemicycleShortInterventions: 0,
			commissionInterventions: 0,
			amendmentsSigned: voteStats.votesFor, // Using votesFor as a proxy
			amendmentsAdopted: 0,
			reports: 0,
			writtenProposals: voteStats.abstentions, // Store abstentions here
			signedProposals: voteStats.votesAgainst, // Store against votes here
			writtenQuestions: voteStats.didNotVote, // Store non-votes here
			oralQuestions: voteStats.totalVotes // Store total votes here
		});

		processed++;
		if (processed % 20 === 0) {
			console.log(
				`[Europarl Activity Stats] Processed ${processed}/${frenchMeps.length} (${statsToInsert.length} with data)`
			);
		}

		// Rate limiting
		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	console.log(`[Europarl Activity Stats] Collected stats for ${statsToInsert.length} MEPs`);

	// Insert in batches
	for (let i = 0; i < statsToInsert.length; i += batchSize) {
		const batch = statsToInsert.slice(i, i + batchSize);

		try {
			await db.insert(actorStats).values(batch).onConflictDoUpdate(actorStatsUpsertConfig);

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[Europarl Activity Stats] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 50 === 0 || i + batchSize >= statsToInsert.length) {
			logProgress(stats, 'Europarl Activity Stats');
		}
	}

	console.log(
		`[Europarl Activity Stats] Import complete: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`
	);

	return stats;
}
