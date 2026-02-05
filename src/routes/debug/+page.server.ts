import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { laws, lawSummaries, lawTags, tags } from '$lib/server/db/schema';
import { eq, desc, isNotNull, isNull, and } from 'drizzle-orm';
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

	// Get tags for each law (in parallel)
	const lawsWithTags = await Promise.all(
		lawsWithSummaries.map(async (law) => {
			const lawTagsList = await db
				.select({
					slug: tags.slug,
					name: tags.name
				})
				.from(lawTags)
				.innerJoin(tags, eq(lawTags.tagSlug, tags.slug))
				.where(eq(lawTags.lawId, law.id));

			return {
				...law,
				tags: lawTagsList.map((t) => t.slug)
			};
		})
	);

	// Laws with full text but no summary
	const lawsWithTextNoSummary = await db
		.select({
			id: laws.id,
			title: laws.shortTitle,
			fullTitle: laws.title
		})
		.from(laws)
		.leftJoin(lawSummaries, eq(laws.id, lawSummaries.lawId))
		.where(and(isNotNull(laws.description), isNull(lawSummaries.lawId)))
		.orderBy(desc(laws.depositDate))
		.limit(50);

	// Stats
	const stats = {
		totalLaws: (await db.select().from(laws)).length,
		lawsWithText: (await db.select().from(laws).where(isNotNull(laws.description))).length,
		lawsWithSummary: lawsWithSummaries.length,
		lawsWithTextNoSummary: lawsWithTextNoSummary.length
	};

	return {
		lawsWithSummaries: lawsWithTags,
		lawsWithTextNoSummary,
		stats
	};
};
