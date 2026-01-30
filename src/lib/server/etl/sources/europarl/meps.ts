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

const PARLTRACK_MEPS_URL = 'https://parltrack.org/dumps/ep_meps.json.zst';
const CACHE_KEY = 'europarl_meps';
const CACHE_OPTIONS: CacheOptions = { ttlHours: 24 };

// Current parliamentary term (2024-2029)
const CURRENT_TERM = 10;

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

		groupMap.set(id, {
			id,
			uid: `EUROPARL-${currentGroup.groupid}`,
			type: 'GP',
			name: currentGroup.Organization,
			shortName: currentGroup.groupid,
			legislature: String(CURRENT_TERM),
			chamber: 'PE',
			startDate: '2024-07-16', // Start of 10th term
			endDate: null,
			color: null  // Colors should be set via etl-colors or manually
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
		constituency: constituency?.party || null
	};
}

/**
 * Import French MEPs from ParlTrack
 */
export async function importEuroparlMeps(config: ETLConfig): Promise<ImportStats> {
	const stats = createImportStats();

	console.log('[EuroParl MEPs] Starting import...');

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
