/**
 * ETL : Enrichissement des textes de lois PE depuis les caches HowTheyVote.eu
 *
 * Stratégie :
 * 1. Lit les lois PE en base (legislature PE-*)
 * 2. Retrouve le cache HTV correspondant via le numéro de référence
 * 3. Extrait les URLs des liens (Summary, Press release, Report)
 * 4. Fetch les pages et nettoie le HTML
 * 5. Combine les sources et met à jour laws.description + laws.sourceUrl
 */

import { db, laws } from '../../../db';
import { eq, like } from 'drizzle-orm';
import { createImportStats, type ImportStats } from '../../types';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MAX_DESCRIPTION_LENGTH = 50000;
const RATE_LIMIT_MS = 500;
const FETCH_TIMEOUT_MS = 30000;

interface HTVCacheData {
	data: {
		id: number;
		reference: string | null;
		display_title: string;
		description: string | null;
		snippet: { text: string; source_type: string; source_url: string } | null;
		links: Array<{ title: string; url: string; description: string }>;
		sources: Array<{ url: string; name: string }>;
	};
}

interface LawTextSources {
	summaryText: string | null;
	pressText: string | null;
	snippetText: string | null;
	reportText: string | null;
	sourceUrl: string | null;
}

export interface EnrichConfig {
	dryRun: boolean;
	limit: number;
	verbose: boolean;
}

export async function enrichPELawTexts(config: EnrichConfig): Promise<ImportStats> {
	const stats = createImportStats();

	// Get PE laws with minimal description
	const peLaws = await db
		.select({
			id: laws.id,
			number: laws.number,
			title: laws.title,
			description: laws.description
		})
		.from(laws)
		.where(like(laws.legislature, 'PE-%'))
		.limit(config.limit);

	stats.total = peLaws.length;
	console.log(`[PE Law Texts] ${peLaws.length} lois PE trouvées`);

	// Load all HTV caches
	const cacheMap = loadHTVCaches();
	console.log(`[PE Law Texts] ${cacheMap.size} caches HTV chargés`);

	for (const law of peLaws) {
		const reference = law.number;
		if (!reference) {
			if (config.verbose) console.log(`  → ${law.id}: pas de numéro de référence, ignoré`);
			stats.skipped++;
			continue;
		}

		const cache = cacheMap.get(reference);
		if (!cache) {
			if (config.verbose) console.log(`  → ${law.id} (${reference}): pas de cache HTV trouvé`);
			stats.skipped++;
			continue;
		}

		// Check if already has a substantial description
		if (law.description && law.description.length > 500) {
			if (config.verbose)
				console.log(
					`  → ${law.id}: description existante (${law.description.length} chars), ignoré`
				);
			stats.skipped++;
			continue;
		}

		console.log(`[PE Law Texts] Traitement de ${reference}: ${law.title.length > 60 ? law.title.slice(0, 60) + '...' : law.title}`);

		try {
			const sources = await fetchLawTextSources(cache, config.verbose);
			const description = buildDescription(sources, cache.data.display_title);

			if (!description || description.length < 50) {
				console.log(`  → Texte insuffisant (${description?.length || 0} chars)`);
				stats.skipped++;
				continue;
			}

			console.log(`  → ${description.length} caractères assemblés`);

			if (config.dryRun) {
				console.log("  → [DRY RUN] N'écrit pas en base");
				stats.updated++;
				continue;
			}

			await db
				.update(laws)
				.set({
					description: description.slice(0, MAX_DESCRIPTION_LENGTH),
					sourceUrl: sources.sourceUrl,
					updatedAt: new Date()
				})
				.where(eq(laws.id, law.id));

			stats.updated++;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error(`  → Erreur: ${message}`);
			stats.errors++;
		}
	}

	return stats;
}

function loadHTVCaches(): Map<string, HTVCacheData> {
	const cacheDir = join(process.cwd(), 'data', 'cache');
	const map = new Map<string, HTVCacheData>();

	let files: string[];
	try {
		files = readdirSync(cacheDir).filter((f) => f.startsWith('htv_votes_') && f.endsWith('.json'));
	} catch {
		console.warn('[PE Law Texts] Répertoire de cache introuvable:', cacheDir);
		return map;
	}

	for (const file of files) {
		try {
			const content = readFileSync(join(cacheDir, file), 'utf-8');
			const cache: HTVCacheData = JSON.parse(content);
			const ref = cache.data?.reference;
			if (ref) {
				map.set(ref, cache);
			}
		} catch {
			// Skip malformed cache files
		}
	}

	return map;
}

async function fetchLawTextSources(cache: HTVCacheData, verbose: boolean): Promise<LawTextSources> {
	const sources: LawTextSources = {
		summaryText: null,
		pressText: null,
		snippetText: null,
		reportText: null,
		sourceUrl: null
	};

	const links = cache.data.links || [];

	// Extract snippet from cache (already available, no fetch needed)
	if (cache.data.snippet?.text) {
		sources.snippetText = cleanHtml(cache.data.snippet.text);
		if (verbose) console.log(`  → Snippet: ${sources.snippetText.length} chars`);
	}

	// Priority 1: OEIL Summary
	const summaryLink = links.find((l) => l.title === 'Summary');
	if (summaryLink) {
		sources.summaryText = await fetchPageText(summaryLink.url, verbose);
		if (sources.summaryText) {
			sources.sourceUrl = summaryLink.url;
		}
	}

	// Priority 2: Press release
	const pressLink = links.find((l) => l.title === 'Press release');
	if (pressLink) {
		sources.pressText = await fetchPageText(pressLink.url, verbose);
		if (sources.pressText && !sources.sourceUrl) {
			sources.sourceUrl = pressLink.url;
		}
	}

	// Priority 3: Report/Resolution (only if nothing else)
	if (!sources.summaryText && !sources.pressText && !sources.snippetText) {
		const reportLink = links.find((l) => l.title === 'Report or resolution');
		if (reportLink) {
			sources.reportText = await fetchPageText(reportLink.url, verbose);
			if (sources.reportText) {
				sources.sourceUrl = reportLink.url;
			}
		}
	}

	// Fallback sourceUrl to Legislative Observatory
	if (!sources.sourceUrl) {
		const oeilLink = links.find((l) => l.title === 'Legislative Observatory');
		if (oeilLink) {
			sources.sourceUrl = oeilLink.url;
		}
	}

	return sources;
}

async function fetchPageText(url: string, verbose: boolean): Promise<string | null> {
	try {
		if (verbose) console.log(`  → Fetch: ${url}`);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'NosElus/1.0 (https://noselus.fr)',
				Accept: 'text/html'
			}
		});

		clearTimeout(timeout);

		if (!response.ok) {
			if (verbose) console.log(`  → HTTP ${response.status} pour ${url}`);
			return null;
		}

		const html = await response.text();
		const text = cleanHtml(html);

		// Rate limiting
		await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

		if (text.length < 50) {
			if (verbose) console.log(`  → Texte trop court (${text.length} chars)`);
			return null;
		}

		if (verbose) console.log(`  → Récupéré: ${text.length} chars`);
		return text;
	} catch (error) {
		if (verbose) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.log(`  → Erreur fetch: ${message}`);
		}
		return null;
	}
}

function cleanHtml(html: string): string {
	return (
		html
			// Balises de structure
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<p[^>]*>/gi, '\n')
			.replace(/<\/p>/gi, '\n')
			.replace(/<li[^>]*>/gi, '\n- ')
			.replace(/<h[1-6][^>]*>/gi, '\n\n')
			.replace(/<\/h[1-6]>/gi, '\n')
			.replace(/<[^>]*>/g, '')
			// Entités HTML nommées courantes
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&laquo;/g, '«')
			.replace(/&raquo;/g, '»')
			.replace(/&ndash;/g, '–')
			.replace(/&mdash;/g, '—')
			.replace(/&hellip;/g, '…')
			.replace(/&euro;/g, '€')
			.replace(/&oelig;/g, 'œ')
			.replace(/&OElig;/g, 'Œ')
			// Entités numériques (décimales et hexadécimales)
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
			.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
			// Nettoyage final
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}

function buildDescription(sources: LawTextSources, displayTitle: string): string {
	const sections: string[] = [];

	// Title context
	if (displayTitle) {
		sections.push(`Titre: ${displayTitle}`);
	}

	// OEIL Summary (most authoritative)
	if (sources.summaryText) {
		sections.push(`--- Résumé officiel (Legislative Observatory) ---\n${sources.summaryText}`);
	}

	// Press release
	if (sources.pressText) {
		sections.push(`--- Communiqué de presse ---\n${sources.pressText}`);
	}

	// Snippet (short extract from cache)
	if (sources.snippetText && sources.snippetText.length > 20) {
		sections.push(`--- Extrait ---\n${sources.snippetText}`);
	}

	// Report/Resolution (fallback only)
	if (sources.reportText) {
		sections.push(`--- Rapport/Résolution ---\n${sources.reportText}`);
	}

	return sections.join('\n\n');
}
