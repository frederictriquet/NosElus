/**
 * Page /verifier — Vérification d'affirmations politiques
 *
 * Stratégie :
 * 1. Détecter un nom de groupe dans la requête (ex: "RN", "LFI") via regex \b
 * 2. Retirer ce nom de groupe avant le fulltext (sinon pas de résultats)
 * 3. Enrichir chaque scrutin avec le % de vote du groupe si détecté
 *
 * Réutilise searchScrutins (noise words + synonymes + fallback ILIKE) de helpers.ts.
 *
 * TODO: getAllGroups() et escapeRegExp() sont dupliqués depuis /recherche — à extraire
 *       vers helpers.ts lors d'un futur refactoring.
 */
import type { PageServerLoad } from './$types';
import { db, organs } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { searchScrutins, extractGroupVote } from '$lib/server/api/helpers';
import { detectDirection, computeVerdict } from '$lib/server/verdict';

// Cache en mémoire pour la liste des groupes (même pattern que /recherche, TTL 1h)
let groupsCache: Array<{ id: string; shortName: string | null }> | null = null;
let groupsCacheExpiry = 0;

async function getAllGroups() {
	const now = Date.now();
	if (groupsCache && now < groupsCacheExpiry) return groupsCache;
	groupsCache = await db
		.select({ id: organs.id, shortName: organs.shortName })
		.from(organs)
		.where(sql`${organs.type} = 'GP' AND ${organs.shortName} IS NOT NULL`);
	groupsCacheExpiry = now + 60 * 60 * 1000;
	return groupsCache;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const limit = 20;

	if (!query || query.length < 2) {
		return { query, scrutins: null, matchedGroupShortName: null, direction: null, verdict: null };
	}

	const allGroups = await getAllGroups();

	const matchedGroup = allGroups.find(
		(g) => g.shortName && new RegExp(`\\b${escapeRegExp(g.shortName)}\\b`, 'i').test(query)
	);

	// Retirer le nom de groupe de la requête fulltext
	const searchQuery = matchedGroup?.shortName
		? query.replace(new RegExp(escapeRegExp(matchedGroup.shortName), 'gi'), '').trim()
		: query;

	const rawScrutins = await searchScrutins(searchQuery || query, limit);

	const scrutins = rawScrutins.map((s) => ({
		id: s.id,
		title: s.title,
		date: s.date,
		number: s.number,
		legislature: s.legislature,
		result: s.result,
		groupVote: matchedGroup ? extractGroupVote(s.groupResults, matchedGroup.id) : null
	}));

	const direction = detectDirection(query);
	const verdict = matchedGroup && direction ? computeVerdict(scrutins, direction) : null;

	return {
		query,
		matchedGroupShortName: matchedGroup?.shortName ?? null,
		scrutins,
		direction,
		verdict
	};
};
