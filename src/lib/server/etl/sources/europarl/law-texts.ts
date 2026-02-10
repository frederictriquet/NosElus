/**
 * ETL : Enrichissement des textes de lois PE depuis l'API HowTheyVote.eu
 *
 * Stratégie :
 * 1. Lit les lois PE en base (legislature PE-*)
 * 2. Retrouve le vote HTV correspondant via la table scrutins (lawId → uid HTV-{id})
 * 3. Appelle l'API HTV /votes/{id} pour obtenir les liens (Summary, Press, Report)
 * 4. Fetch les pages et nettoie le HTML
 * 5. Combine les sources et met à jour laws.description + laws.sourceUrl
 */

import { db, laws, scrutins } from '../../../db';
import { eq, like, and, or, isNull, isNotNull, sql, desc } from 'drizzle-orm';
import { createImportStats, type ImportStats } from '../../types';
import { getCache, setCache } from '../../cache';
import { ETL_CONFIG } from '../../config';
// Fonction partagée pour accéder à l'API HTV (cohérence entre modules PE ETL)
import { fetchHTV } from './shared';

const MAX_DESCRIPTION_LENGTH = 50000;
const RATE_LIMIT_MS = 500;
const FETCH_TIMEOUT_MS = 30000;
const CACHE_KEY_PREFIX = 'htv_votes';
const CACHE_OPTIONS = { ttlHours: ETL_CONFIG.cacheTtl.laws };

/** Réponse complète de l'API HTV /votes/{id} incluant liens et snippet */
interface HTVVoteFullResponse {
	id: number;
	reference: string | null;
	display_title: string;
	description: string | null;
	snippet: { text: string; source_type: string; source_url: string } | null;
	links: Array<{ title: string; url: string; description: string }>;
	sources: Array<{ url: string; name: string }>;
}

export interface LawTextSources {
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

	// Get PE laws not yet enriched (no description or short description)
	const peLaws = await db
		.select({
			id: laws.id,
			number: laws.number,
			title: laws.title
		})
		.from(laws)
		.where(
			and(
				like(laws.legislature, 'PE-%'),
				or(isNull(laws.description), sql`LENGTH(${laws.description}) <= 500`)
			)
		)
		.orderBy(desc(laws.createdAt))
		.limit(config.limit);

	stats.total = peLaws.length;
	console.log(`[PE Law Texts] ${peLaws.length} lois PE trouvées`);

	// Build lawId → HTV vote ID map from DB (single query)
	const voteIdMap = await buildLawToVoteMap();
	console.log(`[PE Law Texts] ${voteIdMap.size} lois liées à un vote HTV`);

	let apiCalls = 0;
	let cacheHits = 0;

	for (const law of peLaws) {
		const reference = law.number;
		if (!reference) {
			if (config.verbose) console.log(`  → ${law.id}: pas de numéro de référence, ignoré`);
			stats.skipped++;
			continue;
		}

		// Look up HTV vote ID from DB mapping
		const htvVoteId = voteIdMap.get(law.id);
		if (!htvVoteId) {
			if (config.verbose) console.log(`  → ${law.id} (${reference}): pas de vote HTV lié en base`);
			stats.skipped++;
			continue;
		}

		console.log(
			`[PE Law Texts] Traitement de ${reference}: ${law.title.length > 60 ? law.title.slice(0, 60) + '...' : law.title}`
		);

		try {
			const { voteData, fromCache } = await fetchVoteData(htvVoteId);
			if (fromCache) cacheHits++;
			else apiCalls++;

			const sources = await fetchLawTextSources(voteData, config.verbose);
			const description = buildDescription(sources, voteData.display_title);

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

	console.log(`[PE Law Texts] API: ${apiCalls} appels, cache: ${cacheHits} hits`);
	return stats;
}

/**
 * Construit un mapping lawId → HTV vote ID depuis la table scrutins.
 * Les scrutins PE ont un uid au format "HTV-{id}" et un lawId lié aux lois.
 */
async function buildLawToVoteMap(): Promise<Map<string, string>> {
	const rows = await db
		.select({
			lawId: scrutins.lawId,
			uid: scrutins.uid
		})
		.from(scrutins)
		.where(
			and(like(scrutins.legislature, 'PE-%'), isNotNull(scrutins.lawId), isNotNull(scrutins.uid))
		);

	const map = new Map<string, string>();
	for (const row of rows) {
		if (!row.lawId || !row.uid) continue;
		const match = row.uid.match(/^HTV-(\d+)$/);
		if (match) {
			map.set(row.lawId, match[1]);
		}
	}
	return map;
}

/** Récupère les données d'un vote HTV (cache → API → setCache) */
async function fetchVoteData(
	voteId: string
): Promise<{ voteData: HTVVoteFullResponse; fromCache: boolean }> {
	const cacheKey = `${CACHE_KEY_PREFIX}_${voteId}`;
	const cached = await getCache<HTVVoteFullResponse>(cacheKey, CACHE_OPTIONS);
	if (cached) {
		return { voteData: cached, fromCache: true };
	}

	const voteData = await fetchHTV<HTVVoteFullResponse>(`/votes/${voteId}`);
	await setCache(cacheKey, voteData, CACHE_OPTIONS);

	// Rate limiting between API calls
	await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

	return { voteData, fromCache: false };
}

async function fetchLawTextSources(
	voteData: HTVVoteFullResponse,
	verbose: boolean
): Promise<LawTextSources> {
	const sources: LawTextSources = {
		summaryText: null,
		pressText: null,
		snippetText: null,
		reportText: null,
		sourceUrl: null
	};

	const links = voteData.links || [];

	// Extract snippet from vote data (already available, no fetch needed)
	if (voteData.snippet?.text) {
		sources.snippetText = cleanHtml(voteData.snippet.text);
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

export function cleanHtml(html: string): string {
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

export function buildDescription(sources: LawTextSources, displayTitle: string): string {
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
