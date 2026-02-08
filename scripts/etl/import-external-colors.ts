/**
 * Import group colors from official external sources
 *
 * Sources:
 * - European Parliament: results.elections.europa.eu (PE groups)
 * - French Senate: senat.fr (SENAT groups)
 *
 * Usage: npx tsx scripts/etl/import-external-colors.ts
 */

import { db, organs } from '../../src/lib/server/db';
import { eq, and, like, isNull } from 'drizzle-orm';
import { execSync } from 'child_process';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

interface GroupColor {
	shortName: string;
	color: string;
}

/**
 * Fetch HTML using curl (handles SSL issues better than fetch)
 */
function fetchWithCurl(url: string): string {
	try {
		return execSync(`curl -sLk "${url}"`, {
			encoding: 'utf-8',
			maxBuffer: 10 * 1024 * 1024
		});
	} catch {
		return '';
	}
}

/**
 * Fetch European Parliament group colors from official election results site
 */
async function fetchEuroparlColors(): Promise<GroupColor[]> {
	console.log('[Colors] Fetching European Parliament colors...');

	const url = 'https://results.elections.europa.eu/en/seats-political-group-country/2024-2029/';

	try {
		const html = fetchWithCurl(url);

		if (!html) {
			throw new Error('Empty response');
		}

		// Extract color mappings from the HTML
		// The site uses background-color styles near group names
		const colors: GroupColor[] = [];

		// Pattern: group name followed by background-color
		const groupPatterns = [
			{ pattern: /EPP[^<]*<[^>]*>.*?background-color:\s*(#[0-9a-fA-F]{6})/s, shortName: 'PPE' },
			{ pattern: /S&amp;D[^<]*<[^>]*>.*?background-color:\s*(#[0-9a-fA-F]{6})/s, shortName: 'S&D' },
			{
				pattern: /PfE[^<]*<[^>]*>.*?background-color:\s*(#[0-9a-fA-F]{6})/s,
				shortName: 'Patriots for Europe Group'
			},
			{ pattern: /ECR[^<]*<[^>]*>.*?background-color:\s*(#[0-9a-fA-F]{6})/s, shortName: 'ECR' },
			{ pattern: /Renew[^<]*<[^>]*>.*?background-color:\s*(#[0-9a-fA-F]{6})/s, shortName: 'RE' },
			{
				pattern: /Greens\/EFA[^<]*<[^>]*>.*?background-color:\s*(#[0-9a-fA-F]{6})/s,
				shortName: 'Verts/ALE'
			},
			{
				pattern: /Left[^<]*<[^>]*>.*?background-color:\s*(#[0-9a-fA-F]{6})/s,
				shortName: 'GUE/NGL'
			},
			{
				pattern: /ESN[^<]*<[^>]*>.*?background-color:\s*(#[0-9a-fA-F]{6})/s,
				shortName: 'Europe of Sovereign Nations Group'
			}
		];

		// Alternative: extract all background colors in order
		// Groups appear in order: EPP, S&D, PfE, ECR, Renew, Greens, Left, ESN, NI
		const colorMatches = html.match(/background-color:\s*(#[0-9a-fA-F]{6})/g) || [];
		const uniqueColors = [
			...new Set(colorMatches.map((m) => m.replace('background-color:', '').trim()))
		];

		// Map colors to groups based on known order from the site
		const groupOrder = [
			{ shortName: 'PPE', index: 0 }, // EPP - blue
			{ shortName: 'S&D', index: 1 }, // S&D - red
			{ shortName: 'Patriots for Europe Group', index: 2 }, // PfE - dark blue
			{ shortName: 'ECR', index: 3 }, // ECR - blue
			{ shortName: 'RE', index: 4 }, // Renew - light blue
			{ shortName: 'Verts/ALE', index: 5 }, // Greens - green
			{ shortName: 'GUE/NGL', index: 6 }, // Left - red
			{ shortName: 'Europe of Sovereign Nations Group', index: 7 }, // ESN - dark gray
			{ shortName: 'NA', index: 8 } // NI - gray
		];

		for (const group of groupOrder) {
			if (uniqueColors[group.index]) {
				colors.push({
					shortName: group.shortName,
					color: uniqueColors[group.index]
				});
			}
		}

		console.log(`[Colors] Found ${colors.length} PE group colors`);
		return colors;
	} catch (error) {
		console.error('[Colors] Failed to fetch EP colors:', error);
		return [];
	}
}

/**
 * Fetch French Senate group colors from official senat.fr site
 */
async function fetchSenatColors(): Promise<GroupColor[]> {
	console.log('[Colors] Fetching Senate colors...');

	const url = 'https://www.senat.fr/vos-senateurs/groupes-politiques.html';

	try {
		const html = fetchWithCurl(url);

		if (!html) {
			throw new Error('Empty response');
		}

		// The page contains a JSON with group colors in an attribute groups="[...]"
		// with HTML entities encoded (e.g., &quot; for ")
		const colors: GroupColor[] = [];

		// Find the groups attribute and decode HTML entities
		// The JSON contains nested arrays like "seats":[1,2,3] so we can't use simple [^\]]
		const groupsAttrMatch = html.match(/groups="(\[.*?\])"/s);

		if (groupsAttrMatch) {
			try {
				// Decode HTML entities
				const decoded = groupsAttrMatch[1]
					.replace(/&quot;/g, '"')
					.replace(/&amp;/g, '&')
					.replace(/&#039;/g, "'")
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>');

				const groupsData = JSON.parse(decoded) as Array<{
					id: string;
					name: string;
					color: string;
				}>;

				for (const group of groupsData) {
					colors.push({
						shortName: group.id,
						color: group.color
					});
				}
			} catch (e) {
				console.error('[Colors] Failed to parse Senate JSON:', e);
			}
		}

		// Fallback: extract individual color patterns using HTML-encoded format
		if (colors.length === 0) {
			const patterns = [
				{
					regex:
						/&quot;id&quot;:&quot;(UMP|LR)&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'LR'
				},
				{
					regex:
						/&quot;id&quot;:&quot;SOC&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'SOC'
				},
				{
					regex:
						/&quot;id&quot;:&quot;UC&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'UC'
				},
				{
					regex:
						/&quot;id&quot;:&quot;RTLI&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'RTLI'
				},
				{
					regex:
						/&quot;id&quot;:&quot;LREM&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'LREM'
				},
				{
					regex:
						/&quot;id&quot;:&quot;CRC&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'CRC'
				},
				{
					regex:
						/&quot;id&quot;:&quot;RDSE&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'RDSE'
				},
				{
					regex:
						/&quot;id&quot;:&quot;GEST&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'GEST'
				},
				{
					regex:
						/&quot;id&quot;:&quot;NI&quot;[^}]*&quot;color&quot;:&quot;(#[0-9a-fA-F]{6})&quot;/,
					shortName: 'NI'
				}
			];

			for (const { regex, shortName } of patterns) {
				const match = html.match(regex);
				if (match) {
					colors.push({ shortName, color: match[1] || match[2] });
				}
			}
		}

		console.log(`[Colors] Found ${colors.length} Senate group colors`);
		return colors;
	} catch (error) {
		console.error('[Colors] Failed to fetch Senate colors:', error);
		return [];
	}
}

/**
 * Update group colors in database
 */
async function updateGroupColors(
	colors: GroupColor[],
	chamber: 'PE' | 'SENAT',
	idPrefix: string
): Promise<{ updated: number; notFound: number }> {
	let updated = 0;
	let notFound = 0;

	for (const { shortName, color } of colors) {
		// Find matching groups by shortName and chamber (update even if color exists)
		const matchingGroups = await db
			.select({ id: organs.id, shortName: organs.shortName, color: organs.color })
			.from(organs)
			.where(
				and(eq(organs.chamber, chamber), eq(organs.type, 'GP'), like(organs.id, `${idPrefix}%`))
			);

		// Find groups matching this shortName (exact match first)
		const exactMatch = matchingGroups.filter((g) => g.shortName === shortName);
		const toUpdate =
			exactMatch.length > 0
				? exactMatch
				: matchingGroups.filter(
						(g) =>
							// Only match if shortName is contained as a whole word
							g.shortName?.toLowerCase() === shortName.toLowerCase()
					);

		if (toUpdate.length === 0) {
			// Try partial match only for PE groups with different naming conventions
			const partialMatch =
				chamber === 'PE'
					? matchingGroups.filter(
							(g) =>
								g.shortName?.toLowerCase().includes(shortName.toLowerCase()) ||
								shortName.toLowerCase().includes(g.shortName?.toLowerCase() || '')
						)
					: [];

			if (partialMatch.length > 0) {
				for (const group of partialMatch) {
					if (group.color === color) {
						console.log(`  = ${group.id} (${group.shortName}) already has ${color}`);
					} else {
						await db.update(organs).set({ color }).where(eq(organs.id, group.id));
						console.log(`  ✓ ${group.id} (${group.shortName}) <- ${color}`);
						updated++;
					}
				}
			} else {
				console.log(`  ✗ No match for ${shortName} (${color})`);
				notFound++;
			}
		} else {
			for (const group of toUpdate) {
				if (group.color === color) {
					console.log(`  = ${group.id} (${group.shortName}) already has ${color}`);
				} else {
					await db.update(organs).set({ color }).where(eq(organs.id, group.id));
					console.log(`  ✓ ${group.id} (${group.shortName}) <- ${color}`);
					updated++;
				}
			}
		}
	}

	return { updated, notFound };
}

async function main() {
	console.log('='.repeat(60));
	console.log('NosElus ETL - Import des couleurs depuis sources externes');
	console.log('='.repeat(60));
	console.log('');

	let totalUpdated = 0;
	let totalNotFound = 0;

	// European Parliament colors
	console.log('\n--- Parlement Européen ---\n');
	const peColors = await fetchEuroparlColors();
	if (peColors.length > 0) {
		const peResult = await updateGroupColors(peColors, 'PE', 'GPEU-');
		totalUpdated += peResult.updated;
		totalNotFound += peResult.notFound;
	}

	// Senate colors
	console.log('\n--- Sénat ---\n');
	const senatColors = await fetchSenatColors();
	if (senatColors.length > 0) {
		const senatResult = await updateGroupColors(senatColors, 'SENAT', 'GPSEN-');
		totalUpdated += senatResult.updated;
		totalNotFound += senatResult.notFound;
	}

	console.log('\n' + '='.repeat(60));
	console.log('RÉSUMÉ');
	console.log('='.repeat(60));
	console.log(`  Couleurs mises à jour: ${totalUpdated}`);
	console.log(`  Sans correspondance: ${totalNotFound}`);
	console.log('='.repeat(60));

	await notifyETLComplete(
		'import-external-colors',
		{
			total: totalUpdated + totalNotFound,
			inserted: 0,
			updated: totalUpdated,
			skipped: totalNotFound,
			errors: 0
		},
		{ dryRun: process.argv.includes('--dry-run') }
	);

	process.exit(0);
}

main();
