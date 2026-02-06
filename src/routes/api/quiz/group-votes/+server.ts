import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { scrutins, organs } from '$lib/server/db/schema';
import { inArray, eq, and, sql } from 'drizzle-orm';

/**
 * API endpoint pour récupérer les votes majoritaires des groupes parlementaires.
 *
 * POST /api/quiz/group-votes
 * Body: { lawIds: string[] }
 *
 * Retourne pour chaque groupe et chaque loi :
 * - La position majoritaire (pour/contre)
 * - Calculée depuis scrutins.groupResults (JSONB)
 *
 * @returns {
 *   groupVotes: { [groupId]: { [lawId]: { majorityPosition: 'pour' | 'contre' } } },
 *   groups: Array<{ id, name, shortName }>
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	let lawIds: string[];

	try {
		const body = await request.json();
		lawIds = body.lawIds;

		if (!Array.isArray(lawIds) || lawIds.length === 0) {
			throw error(400, 'lawIds manquant ou invalide');
		}
	} catch (e) {
		if (isHttpError(e)) throw e;
		throw error(400, 'Corps de requête invalide');
	}

	// Récupérer tous les scrutins concernant ces lois
	const scrutinsData = await db
		.select({
			lawId: scrutins.lawId,
			groupResults: scrutins.groupResults
		})
		.from(scrutins)
		.where(
			and(
				inArray(scrutins.lawId, lawIds),
				eq(scrutins.legislature, '17'),
				sql`${scrutins.groupResults} IS NOT NULL`
			)
		);

	// Récupérer tous les groupes actifs de la L17
	const groupsData = await db
		.select({
			id: organs.id,
			name: organs.name,
			shortName: organs.shortName,
			politicalPosition: organs.politicalPosition
		})
		.from(organs)
		.where(
			and(
				eq(organs.type, 'GP'), // Groupes parlementaires
				eq(organs.legislature, '17')
			)
		);

	// Structure pour stocker les votes par groupe et par loi
	const groupVotes: Record<
		string,
		Record<string, { majorityPosition: 'pour' | 'contre'; pour: number; contre: number }>
	> = {};

	// Initialiser la structure
	for (const group of groupsData) {
		groupVotes[group.id] = {};
	}

	// Parser les groupResults JSONB et calculer la position majoritaire
	for (const scrutin of scrutinsData) {
		if (!scrutin.lawId || !scrutin.groupResults) continue;

		const groupResultsParsed = scrutin.groupResults as Record<
			string,
			{ pour: number; contre: number; abstention: number }
		>;

		for (const [groupId, votes] of Object.entries(groupResultsParsed)) {
			if (!groupVotes[groupId]) continue;

			// Déterminer la position majoritaire
			const pour = votes.pour || 0;
			const contre = votes.contre || 0;

			// Position majoritaire simple (plus de pour ou plus de contre)
			const majorityPosition = pour > contre ? 'pour' : 'contre';

			// Stocker (un scrutin par loi, on prend le premier trouvé)
			// TODO : Si plusieurs scrutins par loi, prendre le scrutin "vote final"
			if (!groupVotes[groupId][scrutin.lawId]) {
				groupVotes[groupId][scrutin.lawId] = { majorityPosition, pour, contre };
			}
		}
	}

	return json({
		groupVotes,
		groups: groupsData
	});
};
