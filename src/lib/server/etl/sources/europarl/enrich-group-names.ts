import { db, organs } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { eq, and, or, isNull } from 'drizzle-orm';

const HTV_API_BASE = 'https://howtheyvote.eu/api';

interface HTVGroup {
	code: string;
	label: string;
	short_label: string;
}

interface HTVVoteStats {
	by_group: Array<{
		group: HTVGroup;
		stats: Record<string, number>;
	}>;
}

interface HTVVote {
	stats: HTVVoteStats;
}

/**
 * Fetch group names from HowTheyVote API
 * We get them from vote stats which include all active groups
 */
async function fetchGroupNamesFromHTV(): Promise<Map<string, string>> {
	const groupNames = new Map<string, string>();

	try {
		// First get a vote ID from the list
		const listResponse = await fetch(`${HTV_API_BASE}/votes?page_size=1`);
		if (!listResponse.ok) {
			throw new Error(`HTV API list error: ${listResponse.status}`);
		}

		const listData = await listResponse.json();
		const voteId = listData.results?.[0]?.id;

		if (!voteId) {
			console.warn('[Enrich Group Names] No votes found in HTV API');
			return groupNames;
		}

		// Fetch the full vote with stats
		const voteResponse = await fetch(`${HTV_API_BASE}/votes/${voteId}`);
		if (!voteResponse.ok) {
			throw new Error(`HTV API vote error: ${voteResponse.status}`);
		}

		const vote: HTVVote = await voteResponse.json();

		if (vote?.stats?.by_group) {
			for (const groupStat of vote.stats.by_group) {
				const group = groupStat.group;
				if (group.code && group.label) {
					groupNames.set(group.code, group.label);
					// Also map short_label if different
					if (group.short_label && group.short_label !== group.code) {
						groupNames.set(group.short_label, group.label);
					}
				}
			}
		}
	} catch (error) {
		console.error('[Enrich Group Names] Error fetching from HTV:', error);
	}

	return groupNames;
}

/**
 * Enrich PE group names from HowTheyVote.eu
 * Updates organs where name equals shortName (missing full name)
 */
export async function enrichPEGroupNames(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[Enrich Group Names] Fetching group names from HowTheyVote.eu...');

	const groupNames = await fetchGroupNamesFromHTV();
	console.log(`[Enrich Group Names] Found ${groupNames.size} group names from HTV`);

	// Get PE groups that might need enrichment (name same as shortName or very short)
	const peGroups = await db
		.select()
		.from(organs)
		.where(and(eq(organs.chamber, 'PE'), eq(organs.type, 'GP')));

	console.log(`[Enrich Group Names] Found ${peGroups.length} PE groups in database`);
	stats.total = peGroups.length;

	for (const group of peGroups) {
		// Try to find full name from HTV using shortName
		const fullName = groupNames.get(group.shortName || '') || groupNames.get(group.name || '');

		// Check if name needs enrichment
		const currentName = group.name || '';
		const needsEnrichment =
			!group.name || group.name === group.shortName || currentName.length <= 15;

		if (!needsEnrichment) {
			stats.skipped++;
			continue;
		}

		if (fullName && fullName !== group.name) {
			try {
				await db.update(organs).set({ name: fullName }).where(eq(organs.id, group.id));

				console.log(
					`[Enrich Group Names] Updated: ${group.shortName} (${group.name}) -> ${fullName}`
				);
				stats.updated++;
			} catch (error) {
				console.error(`[Enrich Group Names] Error updating ${group.id}:`, error);
				stats.errors++;
			}
		} else {
			// Log skipped for debug
			if (needsEnrichment && !fullName) {
				console.log(
					`[Enrich Group Names] No HTV name found for: ${group.shortName} (${group.name})`
				);
			}
			stats.skipped++;
		}
	}

	console.log(
		`[Enrich Group Names] Complete: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`
	);

	return stats;
}
