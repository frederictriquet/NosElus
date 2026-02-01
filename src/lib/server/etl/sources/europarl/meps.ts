import { db, actors, organs, mandates } from '../../../db';
import { createImportStats, type ImportStats, type ETLConfig } from '../../types';
import { logProgress } from '../../utils';
import { sql, eq, and, like } from 'drizzle-orm';
import type { NewActor, NewOrgan, NewMandate } from '../../../db';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { getCache, setCache, type CacheOptions } from '../../cache';
import {
	PE_SOURCES,
	PE_OFFICIAL_TERM_DATES,
	PE_HISTORICAL_MIN_TERM,
	ETL_CONFIG
} from '../../config';
import { getCurrentTerm as getCurrentPETerm, getTermDates } from '../../../periods/pe-terms';

const PARLTRACK_MEPS_URL = PE_SOURCES.parltrackMepsUrl;
const CACHE_KEY = 'europarl_meps';
const CACHE_OPTIONS: CacheOptions = { ttlHours: ETL_CONFIG.cacheTtl.meps };

// Historical import starts from term 6 (2004-2009)
const HISTORICAL_MIN_TERM = PE_HISTORICAL_MIN_TERM;

// Official term dates as fallback for ETL (before DB has data)
const TERM_DATES = PE_OFFICIAL_TERM_DATES;

// Will be set dynamically at import time
let CURRENT_TERM = 10;

interface ParlTrackGroup {
	role: string;
	Organization: string;
	groupid: string;
	start: string;
	end: string;
}

interface ParlTrackConstituency {
	party: string;
	country: string;
	start: string;
	end: string;
	term: number;
}

interface ParlTrackMEP {
	UserID: number;
	Name: {
		full: string;
		sur?: string | null;  // First name
		family?: string | null;  // Last name
		aliases?: string[];
		title?: string;
	};
	Photo?: string;
	active: boolean;
	Birth?: {
		date?: string;
		place?: string;
	};
	Gender?: string;
	Groups?: ParlTrackGroup[];
	Constituencies?: ParlTrackConstituency[];
	Twitter?: string[];
	Facebook?: string[];
	Mail?: string[];
	Death?: string;
}

/**
 * Generate a short hash from a string (for ID generation)
 */
function shortHash(input: string): string {
	return createHash('md5').update(input).digest('hex').slice(0, 10);
}

/**
 * Generate unique ID for a MEP
 */
function generateMepId(userId: number): string {
	return `MEP-${userId}`;
}

/**
 * Generate unique ID for an EU political group (max 20 chars total)
 * Uses a hash to avoid hardcoding group name mappings
 */
function generateGroupId(groupId: string): string {
	// Use hash to generate a consistent short ID from any groupId
	return `GPEU-${shortHash(groupId)}`;
}

/**
 * Download and decompress the ParlTrack MEPs dump
 */
async function downloadMepsDump(): Promise<ParlTrackMEP[]> {
	// Check cache first
	const cached = await getCache<ParlTrackMEP[]>(CACHE_KEY, CACHE_OPTIONS);
	if (cached) {
		console.log('[EuroParl MEPs] Using cached data');
		return cached;
	}

	console.log('[EuroParl MEPs] Downloading from ParlTrack...');

	const cacheDir = 'data/cache';
	const zstFile = path.join(cacheDir, 'ep_meps.json.zst');
	const jsonFile = path.join(cacheDir, 'ep_meps.json');

	// Create cache directory
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true });
	}

	// Download the file
	execSync(`curl -sL "${PARLTRACK_MEPS_URL}" -o "${zstFile}"`, { stdio: 'inherit' });

	// Decompress with zstd
	try {
		execSync(`zstd -d -f "${zstFile}" -o "${jsonFile}"`, { stdio: 'inherit' });
	} catch {
		// Try with unzstd if zstd is not available
		execSync(`unzstd -f "${zstFile}" -o "${jsonFile}"`, { stdio: 'inherit' });
	}

	// Parse the JSON file (special format: one JSON object per line starting with ',')
	const content = fs.readFileSync(jsonFile, 'utf-8');
	const lines = content.split('\n');
	const meps: ParlTrackMEP[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed === '[' || trimmed === ']') continue;

		// Remove leading comma if present
		const jsonStr = trimmed.startsWith(',') ? trimmed.slice(1) : trimmed;
		// Remove trailing comma if present
		const cleanJson = jsonStr.endsWith(',') ? jsonStr.slice(0, -1) : jsonStr;

		if (cleanJson) {
			try {
				const mep = JSON.parse(cleanJson);
				meps.push(mep);
			} catch {
				// Skip invalid lines
			}
		}
	}

	// Cache the parsed data
	await setCache(CACHE_KEY, meps, CACHE_OPTIONS);

	// Cleanup
	fs.unlinkSync(zstFile);
	fs.unlinkSync(jsonFile);

	return meps;
}

/**
 * Check if a MEP is French in the current term
 */
function isFrenchMepCurrentTerm(mep: ParlTrackMEP): boolean {
	if (!mep.Constituencies) return false;

	return mep.Constituencies.some(c =>
		c && c.country === 'France' && c.term === CURRENT_TERM
	);
}

/**
 * Get current group for a MEP
 */
function getCurrentGroup(mep: ParlTrackMEP): ParlTrackGroup | null {
	if (!mep.Groups || mep.Groups.length === 0) return null;

	// Find the most recent group (no end date or end date in the future)
	const now = new Date();
	const currentGroups = mep.Groups.filter(g => {
		if (!g) return false;
		if (!g.end) return true;
		return new Date(g.end) > now;
	});

	if (currentGroups.length === 0) {
		// Return the most recent ended group
		const validGroups = mep.Groups.filter((g): g is ParlTrackGroup => g !== null);
		if (validGroups.length === 0) return null;
		return validGroups.sort((a, b) =>
			new Date(b.end || '9999').getTime() - new Date(a.end || '9999').getTime()
		)[0];
	}

	return currentGroups[0];
}

/**
 * Map a ParlTrack MEP to Actor
 */
function mapMepToActor(mep: ParlTrackMEP): NewActor {
	const id = generateMepId(mep.UserID);

	// Parse birth date
	let birthDate: string | null = null;
	if (mep.Birth?.date) {
		const d = new Date(mep.Birth.date);
		if (!isNaN(d.getTime())) {
			birthDate = d.toISOString().split('T')[0];
		}
	}

	// Get current party as profession
	const currentConstituency = mep.Constituencies?.find(c =>
		c && c.country === 'France' && c.term === CURRENT_TERM
	);

	return {
		id,
		uid: String(mep.UserID),
		civility: mep.Gender === 'F' ? 'Mme' : mep.Gender === 'M' ? 'M.' : null,
		firstName: mep.Name.sur || '',
		lastName: mep.Name.family || '',
		fullName: mep.Name.full,
		birthDate,
		birthPlace: mep.Birth?.place || null,
		profession: currentConstituency?.party || null,
		photoUrl: mep.Photo || null,
		chamber: 'PE'  // Parlement Européen
	};
}

/**
 * Extract unique EU political groups
 */
function extractGroups(meps: ParlTrackMEP[]): NewOrgan[] {
	const groupMap = new Map<string, NewOrgan>();

	for (const mep of meps) {
		const currentGroup = getCurrentGroup(mep);
		if (!currentGroup) continue;

		const id = generateGroupId(currentGroup.groupid);
		if (groupMap.has(id)) continue;

		// Use ParlTrack Organization field, fallback to groupid
		const fullName = currentGroup.Organization || currentGroup.groupid;

		groupMap.set(id, {
			id,
			uid: `EUROPARL-${currentGroup.groupid}`,
			type: 'GP',
			name: fullName,
			shortName: currentGroup.groupid,
			legislature: String(CURRENT_TERM),
			chamber: 'PE',
			startDate: '2024-07-16', // Start of 10th term
			endDate: null,
			color: null // Colors should be set via etl-colors or manually
		});
	}

	return Array.from(groupMap.values());
}

/**
 * Create group mandate for a MEP
 */
function createGroupMandate(mep: ParlTrackMEP): NewMandate | null {
	const currentGroup = getCurrentGroup(mep);
	if (!currentGroup) return null;

	const actorId = generateMepId(mep.UserID);
	const organId = generateGroupId(currentGroup.groupid);

	// Parse start date
	let startDate = '2024-07-16'; // Default to term start
	if (currentGroup.start) {
		const d = new Date(currentGroup.start);
		if (!isNaN(d.getTime())) {
			startDate = d.toISOString().split('T')[0];
		}
	}

	// Get constituency for current term
	const constituency = mep.Constituencies?.find(c =>
		c && c.country === 'France' && c.term === CURRENT_TERM
	);

	return {
		id: `${actorId}-${organId}`,
		actorId,
		organId,
		legislature: String(CURRENT_TERM),
		type: 'membre',
		quality: currentGroup.role || 'Member',
		startDate,
		endDate: null,
		constituency: constituency?.party?.slice(0, 100) || null
	};
}

// ============================================================================
// HISTORICAL IMPORT FUNCTIONS (since 2004)
// ============================================================================

/**
 * Check if MEP has any French mandate since 2004
 */
function isFrenchMepHistorical(mep: ParlTrackMEP): boolean {
	if (!mep.Constituencies) return false;

	return mep.Constituencies.some(c =>
		c && c.country === 'France' && c.term >= HISTORICAL_MIN_TERM
	);
}

/**
 * Get all terms where MEP was French representative
 */
function getFrenchTerms(mep: ParlTrackMEP): number[] {
	if (!mep.Constituencies) return [];

	return [...new Set(
		mep.Constituencies
			.filter(c => c && c.country === 'France' && c.term >= HISTORICAL_MIN_TERM)
			.map(c => c.term)
	)].sort();
}

/**
 * Extract all historical groups from MEPs
 */
function extractAllGroups(meps: ParlTrackMEP[]): NewOrgan[] {
	const groupMap = new Map<string, NewOrgan>();

	for (const mep of meps) {
		if (!mep.Groups) continue;

		// Get terms this MEP was French representative
		const frenchTerms = getFrenchTerms(mep);
		if (frenchTerms.length === 0) continue;

		for (const group of mep.Groups) {
			if (!group || !group.groupid) continue;

			// Parse group dates
			const groupStart = group.start ? new Date(group.start) : null;
			const groupEnd = group.end && group.end !== '9999-12-31T00:00:00' ? new Date(group.end) : null;

			// Check which terms this group membership covers
			for (const term of frenchTerms) {
				const termDates = TERM_DATES[term];
				if (!termDates) continue;

				const termStart = new Date(termDates.start);
				const termEnd = termDates.end ? new Date(termDates.end) : new Date();

				// Check if group membership overlaps with term
				const overlaps = (
					(!groupStart || groupStart <= termEnd) &&
					(!groupEnd || groupEnd >= termStart)
				);

				if (!overlaps) continue;

				// Create unique ID per group per term
				const id = generateGroupId(`${group.groupid}-${term}`);
				if (groupMap.has(id)) continue;

				groupMap.set(id, {
					id,
					uid: `EUROPARL-${group.groupid}-T${term}`,
					type: 'GP',
					name: group.Organization,
					shortName: group.groupid,
					legislature: String(term),
					chamber: 'PE',
					startDate: termDates.start,
					endDate: termDates.end,
					color: null
				});
			}
		}
	}

	return Array.from(groupMap.values());
}

/**
 * Create all historical mandates for a MEP
 */
function createAllGroupMandates(mep: ParlTrackMEP): NewMandate[] {
	const mandatesList: NewMandate[] = [];
	if (!mep.Groups) return mandatesList;

	const actorId = generateMepId(mep.UserID);
	const frenchTerms = getFrenchTerms(mep);

	for (const group of mep.Groups) {
		if (!group || !group.groupid) continue;

		// Parse group dates
		const groupStart = group.start ? new Date(group.start) : null;
		const groupEndRaw = group.end && group.end !== '9999-12-31T00:00:00' ? new Date(group.end) : null;

		// Check which terms this group membership covers
		for (const term of frenchTerms) {
			const termDates = TERM_DATES[term];
			if (!termDates) continue;

			const termStart = new Date(termDates.start);
			const termEnd = termDates.end ? new Date(termDates.end) : new Date();

			// Check if group membership overlaps with term
			const overlaps = (
				(!groupStart || groupStart <= termEnd) &&
				(!groupEndRaw || groupEndRaw >= termStart)
			);

			if (!overlaps) continue;

			// Calculate effective dates within the term
			const effectiveStart = groupStart && groupStart > termStart ? groupStart : termStart;
			const effectiveEnd = groupEndRaw && groupEndRaw < termEnd ? groupEndRaw : termEnd;

			const organId = generateGroupId(`${group.groupid}-${term}`);

			// Find constituency for this term
			const constituency = mep.Constituencies?.find(c =>
				c && c.country === 'France' && c.term === term
			);

			// Generate mandate ID (must fit in 50 chars)
			const startDateStr = effectiveStart.toISOString().split('T')[0];
			const mandateId = `${actorId}-${organId.slice(0, 15)}-${startDateStr}`.slice(0, 50);

			// Truncate constituency to 100 chars
			const constituencyValue = constituency?.party?.slice(0, 100) || null;

			mandatesList.push({
				id: mandateId,
				actorId,
				organId,
				legislature: String(term),
				type: 'membre',
				quality: group.role || 'Member',
				startDate: startDateStr,
				endDate: term === CURRENT_TERM ? null : effectiveEnd.toISOString().split('T')[0],
				constituency: constituencyValue
			});
		}
	}

	return mandatesList;
}

/**
 * Map a historical MEP to Actor (includes all terms info)
 */
function mapHistoricalMepToActor(mep: ParlTrackMEP): NewActor {
	const id = generateMepId(mep.UserID);

	// Parse birth date
	let birthDate: string | null = null;
	if (mep.Birth?.date) {
		const d = new Date(mep.Birth.date);
		if (!isNaN(d.getTime())) {
			birthDate = d.toISOString().split('T')[0];
		}
	}

	// Get most recent party
	const frenchConstituencies = mep.Constituencies?.filter(c => c && c.country === 'France') || [];
	const mostRecent = frenchConstituencies.sort((a, b) => b.term - a.term)[0];

	return {
		id,
		uid: String(mep.UserID),
		civility: mep.Gender === 'F' ? 'Mme' : mep.Gender === 'M' ? 'M.' : null,
		firstName: mep.Name.sur || '',
		lastName: mep.Name.family || '',
		fullName: mep.Name.full,
		birthDate,
		birthPlace: mep.Birth?.place || null,
		profession: mostRecent?.party || null,
		photoUrl: mep.Photo || null,
		chamber: 'PE'
	};
}

/**
 * Import historical French MEPs from ParlTrack (since 2004)
 */
export async function importEuroparlHistoricalMeps(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[EuroParl Historical] Starting import since 2004 (term 6)...');

	// Download and parse data
	const allMeps = await downloadMepsDump();
	console.log(`[EuroParl Historical] Total MEPs in dump: ${allMeps.length}`);

	// Filter French MEPs from any term since 2004
	const frenchMeps = allMeps.filter(isFrenchMepHistorical);
	console.log(`[EuroParl Historical] French MEPs since 2004: ${frenchMeps.length}`);
	stats.total = frenchMeps.length;

	if (frenchMeps.length === 0) {
		console.log('[EuroParl Historical] No French MEPs found');
		return stats;
	}

	// Extract and insert all historical groups
	const groups = extractAllGroups(frenchMeps);
	console.log(`[EuroParl Historical] Found ${groups.length} historical EU political groups`);

	if (groups.length > 0) {
		try {
			// Clean old PE mandates first (votes must be cleaned separately if needed)
			await db.delete(mandates).where(like(mandates.organId, 'GPEU-%'));
			console.log('[EuroParl Historical] Cleaned old PE mandates');

			// Upsert groups (don't delete to preserve vote foreign keys)
			for (let i = 0; i < groups.length; i += config.batchSize) {
				const batch = groups.slice(i, i + config.batchSize);
				await db
					.insert(organs)
					.values(batch)
					.onConflictDoUpdate({
						target: organs.id,
						set: {
							name: sql`excluded.name`,
							shortName: sql`excluded.short_name`,
							legislature: sql`excluded.legislature`,
							startDate: sql`excluded.start_date`,
							endDate: sql`excluded.end_date`,
							updatedAt: sql`now()`
						}
					});
			}
			console.log(`[EuroParl Historical] Upserted ${groups.length} groups`);
		} catch (error) {
			console.error('[EuroParl Historical] Error inserting groups:', error);
		}
	}

	// Insert MEPs
	const actorsList = frenchMeps.map(mapHistoricalMepToActor);
	const batchSize = config.batchSize;

	for (let i = 0; i < actorsList.length; i += batchSize) {
		const batch = actorsList.slice(i, i + batchSize);

		try {
			await db
				.insert(actors)
				.values(batch)
				.onConflictDoUpdate({
					target: actors.id,
					set: {
						firstName: sql`excluded.first_name`,
						lastName: sql`excluded.last_name`,
						fullName: sql`excluded.full_name`,
						civility: sql`excluded.civility`,
						birthDate: sql`excluded.birth_date`,
						birthPlace: sql`excluded.birth_place`,
						profession: sql`excluded.profession`,
						photoUrl: sql`excluded.photo_url`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[EuroParl Historical] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 100 === 0 || i + batchSize >= actorsList.length) {
			logProgress(stats, 'EuroParl Historical');
		}
	}

	// Create all historical mandates
	const mandatesList: NewMandate[] = [];
	for (const mep of frenchMeps) {
		mandatesList.push(...createAllGroupMandates(mep));
	}

	console.log(`[EuroParl Historical] Creating ${mandatesList.length} mandates...`);

	for (let i = 0; i < mandatesList.length; i += batchSize) {
		const batch = mandatesList.slice(i, i + batchSize);

		try {
			await db
				.insert(mandates)
				.values(batch)
				.onConflictDoUpdate({
					target: mandates.id,
					set: {
						quality: sql`excluded.quality`,
						constituency: sql`excluded.constituency`,
						startDate: sql`excluded.start_date`,
						endDate: sql`excluded.end_date`,
						updatedAt: sql`now()`
					}
				});
		} catch (error) {
			console.error(`[EuroParl Historical] Error inserting mandates:`, error);
		}
	}

	console.log(
		`[EuroParl Historical] Import complete: ${stats.inserted} MEPs, ${mandatesList.length} mandates, ${stats.errors} errors`
	);

	return stats;
}

/**
 * Import French MEPs from ParlTrack
 */
export async function importEuroparlMeps(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[EuroParl MEPs] Starting import...');

	// Get current term dynamically from database (or fallback to latest known)
	try {
		const currentTermStr = await getCurrentPETerm();
		CURRENT_TERM = parseInt(currentTermStr, 10);
		console.log(`[EuroParl MEPs] Using term ${CURRENT_TERM} from database`);
	} catch {
		console.log(`[EuroParl MEPs] Using fallback term ${CURRENT_TERM}`);
	}

	// Download and parse data
	const allMeps = await downloadMepsDump();
	console.log(`[EuroParl MEPs] Total MEPs in dump: ${allMeps.length}`);

	// Filter French MEPs in current term
	const frenchMeps = allMeps.filter(isFrenchMepCurrentTerm);
	console.log(`[EuroParl MEPs] French MEPs in term ${CURRENT_TERM}: ${frenchMeps.length}`);
	stats.total = frenchMeps.length;

	if (frenchMeps.length === 0) {
		console.log('[EuroParl MEPs] No French MEPs found');
		return stats;
	}

	// Extract and insert groups
	const groups = extractGroups(frenchMeps);
	console.log(`[EuroParl MEPs] Found ${groups.length} EU political groups`);

	if (groups.length > 0) {
		try {
			// First, delete old PE mandates and groups to avoid ID conflicts
			// (IDs are generated via hash and may differ from previous imports)
			await db.delete(mandates).where(like(mandates.organId, 'GPEU-%'));
			await db.delete(organs).where(and(
				eq(organs.chamber, 'PE'),
				eq(organs.type, 'GP')
			));
			console.log('[EuroParl MEPs] Cleaned old PE groups and mandates');

			// Insert fresh groups
			await db.insert(organs).values(groups);
			console.log(`[EuroParl MEPs] Inserted ${groups.length} groups`);
		} catch (error) {
			console.error('[EuroParl MEPs] Error inserting groups:', error);
		}
	}

	// Insert MEPs
	const actorsList = frenchMeps.map(mapMepToActor);
	const batchSize = config.batchSize;

	for (let i = 0; i < actorsList.length; i += batchSize) {
		const batch = actorsList.slice(i, i + batchSize);

		try {
			await db
				.insert(actors)
				.values(batch)
				.onConflictDoUpdate({
					target: actors.id,
					set: {
						firstName: sql`excluded.first_name`,
						lastName: sql`excluded.last_name`,
						fullName: sql`excluded.full_name`,
						civility: sql`excluded.civility`,
						birthDate: sql`excluded.birth_date`,
						birthPlace: sql`excluded.birth_place`,
						profession: sql`excluded.profession`,
						photoUrl: sql`excluded.photo_url`,
						updatedAt: sql`now()`
					}
				});

			stats.inserted += batch.length;
		} catch (error) {
			console.error(`[EuroParl MEPs] Error inserting batch:`, error);
			stats.errors += batch.length;
		}

		if ((i + batchSize) % 50 === 0 || i + batchSize >= actorsList.length) {
			logProgress(stats, 'EuroParl MEPs');
		}
	}

	// Create mandates
	const mandatesList = frenchMeps
		.map(createGroupMandate)
		.filter((m): m is NewMandate => m !== null);

	console.log(`[EuroParl MEPs] Creating ${mandatesList.length} mandates...`);

	for (let i = 0; i < mandatesList.length; i += batchSize) {
		const batch = mandatesList.slice(i, i + batchSize);

		try {
			await db
				.insert(mandates)
				.values(batch)
				.onConflictDoUpdate({
					target: mandates.id,
					set: {
						quality: sql`excluded.quality`,
						constituency: sql`excluded.constituency`,
						updatedAt: sql`now()`
					}
				});
		} catch (error) {
			console.error(`[EuroParl MEPs] Error inserting mandates:`, error);
		}
	}

	console.log(
		`[EuroParl MEPs] Import complete: ${stats.inserted} inserted, ${stats.errors} errors`
	);

	return stats;
}
