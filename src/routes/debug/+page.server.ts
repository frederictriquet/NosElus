import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { laws, lawSummaries, lawTags, tags } from '$lib/server/db/schema';
import { eq, desc, isNotNull, isNull, and, inArray, gt, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Only accessible in development
	if (!dev) {
		throw error(404, 'Not found');
	}

	// Laws with AI summaries
	const lawsWithSummaries = await db
		.select({
			id: laws.id,
			title: laws.shortTitle,
			fullTitle: laws.title,
			hasDescription: isNotNull(laws.description),
			summary: lawSummaries.summary,
			model: lawSummaries.model,
			analyzedAt: lawSummaries.analyzedAt
		})
		.from(lawSummaries)
		.innerJoin(laws, eq(lawSummaries.lawId, laws.id))
		.orderBy(desc(lawSummaries.analyzedAt))
		.limit(100);

	// Get tags for displayed laws (batch, avoids N+1)
	const lawIds = lawsWithSummaries.map((l) => l.id);
	const lawTagsData =
		lawIds.length > 0
			? await db
					.select({
						lawId: lawTags.lawId,
						slug: tags.slug,
						name: tags.name,
						color: tags.color
					})
					.from(lawTags)
					.innerJoin(tags, eq(lawTags.tagSlug, tags.slug))
					.where(inArray(lawTags.lawId, lawIds))
			: [];

	const tagsByLawId = new Map<string, { slug: string; name: string; color: string | null }[]>();
	for (const row of lawTagsData) {
		if (!tagsByLawId.has(row.lawId)) {
			tagsByLawId.set(row.lawId, []);
		}
		tagsByLawId.get(row.lawId)!.push({ slug: row.slug, name: row.name, color: row.color });
	}

	const lawsWithTags = lawsWithSummaries.map((law) => ({
		...law,
		tags: tagsByLawId.get(law.id) ?? []
	}));

	// Laws with full text but no summary
	const lawsWithTextNoSummary = await db
		.select({
			id: laws.id,
			title: laws.shortTitle,
			fullTitle: laws.title
		})
		.from(laws)
		.leftJoin(lawSummaries, eq(laws.id, lawSummaries.lawId))
		.where(and(gt(sql`length(${laws.description})`, 100), isNull(lawSummaries.lawId)))
		.orderBy(desc(laws.depositDate))
		.limit(50);

	// Stats
	const stats = {
		totalLaws: (await db.select().from(laws)).length,
		lawsWithText: (
			await db
				.select()
				.from(laws)
				.where(gt(sql`length(${laws.description})`, 100))
		).length,
		lawsWithSummary: lawsWithSummaries.length,
		lawsWithTextNoSummary: lawsWithTextNoSummary.length
	};

	return {
		lawsWithSummaries: lawsWithTags,
		lawsWithTextNoSummary,
		stats
	};
};
