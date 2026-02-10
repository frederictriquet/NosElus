import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { lawTextSkipList, laws } from '$lib/server/db/schema';
import { eq, count, desc } from 'drizzle-orm';
import { createLegifranceClient } from '$lib/server/etl/sources/legifrance/client';
import {
	extractTextFromResponse,
	MAX_DESCRIPTION_LENGTH
} from '$lib/server/etl/sources/legifrance/text-matching';

const PAGE_SIZE = 20;

async function fetchAndAssociateText(lawId: string, textId: string) {
	const client = createLegifranceClient();
	const texte = await client.getTexteComplet(textId);
	const fullText = extractTextFromResponse(texte);

	if (fullText.length < 100) {
		return fail(400, { error: 'Texte trop court pour etre associe' });
	}

	await db.transaction(async (tx) => {
		await tx
			.update(laws)
			.set({
				description: fullText.slice(0, MAX_DESCRIPTION_LENGTH),
				updatedAt: new Date()
			})
			.where(eq(laws.id, lawId));

		await tx.delete(lawTextSkipList).where(eq(lawTextSkipList.lawId, lawId));
	});

	return null;
}

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const reasonFilter = url.searchParams.get('reason') || '';

	// Compteurs par raison
	const countsResult = await db
		.select({
			reason: lawTextSkipList.reason,
			count: count()
		})
		.from(lawTextSkipList)
		.groupBy(lawTextSkipList.reason);

	const counts: Record<string, number> = {};
	let totalCount = 0;
	for (const row of countsResult) {
		counts[row.reason] = row.count;
		totalCount += row.count;
	}

	// Requête principale avec JOIN
	const baseQuery = db
		.select({
			lawId: lawTextSkipList.lawId,
			reason: lawTextSkipList.reason,
			bestScore: lawTextSkipList.bestScore,
			bestMatchTitle: lawTextSkipList.bestMatchTitle,
			bestMatchTextId: lawTextSkipList.bestMatchTextId,
			attemptedAt: lawTextSkipList.attemptedAt,
			threshold: lawTextSkipList.threshold,
			lawTitle: laws.title,
			lawShortTitle: laws.shortTitle,
			lawNumber: laws.number,
			lawType: laws.type,
			lawStatus: laws.status,
			lawLegislature: laws.legislature,
			lawTheme: laws.theme,
			lawInitiator: laws.initiator,
			lawDepositDate: laws.depositDate,
			lawPromulgationDate: laws.promulgationDate,
			lawSourceUrl: laws.sourceUrl
		})
		.from(lawTextSkipList)
		.innerJoin(laws, eq(lawTextSkipList.lawId, laws.id));

	const entries = await (
		reasonFilter ? baseQuery.where(eq(lawTextSkipList.reason, reasonFilter)) : baseQuery
	)
		.orderBy(desc(lawTextSkipList.attemptedAt))
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE);

	const filteredTotal = reasonFilter ? counts[reasonFilter] || 0 : totalCount;
	const totalPages = Math.ceil(filteredTotal / PAGE_SIZE);

	// Vérifier si PISTE est configuré
	const pisteConfigured = !!(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET);

	return {
		entries,
		counts,
		totalCount,
		page,
		totalPages,
		reasonFilter,
		pisteConfigured
	};
};

export const actions = {
	approve: async ({ request, locals }) => {
		if (!locals.adminAuthenticated) {
			return fail(401, { error: 'Non authentifie' });
		}

		const data = await request.formData();
		const lawId = data.get('lawId')?.toString();
		const textId = data.get('textId')?.toString();

		if (!lawId || !textId) {
			return fail(400, { error: 'lawId et textId requis' });
		}

		try {
			const result = await fetchAndAssociateText(lawId, textId);
			if (result) return result;
			return { success: true, action: 'approve' };
		} catch (err) {
			console.error('Erreur approbation:', err);
			return fail(500, { error: 'Erreur lors de la recuperation du texte Legifrance' });
		}
	},

	associate: async ({ request, locals }) => {
		if (!locals.adminAuthenticated) {
			return fail(401, { error: 'Non authentifie' });
		}

		const data = await request.formData();
		const lawId = data.get('lawId')?.toString();
		const textId = data.get('textId')?.toString();

		if (!lawId || !textId) {
			return fail(400, { error: 'lawId et textId requis' });
		}

		try {
			const result = await fetchAndAssociateText(lawId, textId);
			if (result) return result;
			return { success: true, action: 'associate' };
		} catch (err) {
			console.error('Erreur association:', err);
			return fail(500, { error: 'Erreur lors de la recuperation du texte Legifrance' });
		}
	},

	dismiss: async ({ request, locals }) => {
		if (!locals.adminAuthenticated) {
			return fail(401, { error: 'Non authentifie' });
		}

		const data = await request.formData();
		const lawId = data.get('lawId')?.toString();

		if (!lawId) {
			return fail(400, { error: 'lawId requis' });
		}

		await db.delete(lawTextSkipList).where(eq(lawTextSkipList.lawId, lawId));

		return { success: true, action: 'dismiss' };
	}
} satisfies Actions;
