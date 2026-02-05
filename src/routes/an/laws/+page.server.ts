import type { PageServerLoad } from './$types';
import { db, laws, lawTags, tags } from '$lib/server/db';
import { count, ilike, eq, desc, and, asc, inArray, type SQL } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 20;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q') || '';
	const type = url.searchParams.get('type') || '';
	const status = url.searchParams.get('status') || '';
	const tag = url.searchParams.get('tag') || '';
	const legislature = locals.periods.an;

	// Build where conditions
	const conditions: SQL[] = [];

	if (search) {
		conditions.push(ilike(laws.title, `%${search}%`));
	}

	if (type) {
		conditions.push(eq(laws.type, type));
	}

	if (status) {
		conditions.push(eq(laws.status, status));
	}

	if (legislature && legislature !== 'all') {
		conditions.push(eq(laws.legislature, legislature));
	}

	// Filter by tag: law must have a matching entry in law_tags
	if (tag) {
		const lawIdsWithTag = db
			.select({ lawId: lawTags.lawId })
			.from(lawTags)
			.where(eq(lawTags.tagSlug, tag));
		conditions.push(inArray(laws.id, lawIdsWithTag));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Load filter options and data in parallel
	const [typeOptions, statusOptions, availableTags, [{ value: total }], lawsList] =
		await Promise.all([
			// Types for filter dropdown
			db
				.selectDistinct({ type: laws.type })
				.from(laws)
				.where(legislature && legislature !== 'all' ? eq(laws.legislature, legislature) : undefined)
				.orderBy(laws.type),

			// Statuses for filter dropdown
			db
				.selectDistinct({ status: laws.status })
				.from(laws)
				.where(legislature && legislature !== 'all' ? eq(laws.legislature, legislature) : undefined)
				.orderBy(laws.status),

			// All available tags for filter dropdown
			db
				.select({ slug: tags.slug, name: tags.name, color: tags.color })
				.from(tags)
				.orderBy(asc(tags.name)),

			// Total count
			db.select({ value: count() }).from(laws).where(whereClause),

			// Paginated data
			db
				.select({
					id: laws.id,
					title: laws.title,
					shortTitle: laws.shortTitle,
					type: laws.type,
					status: laws.status,
					depositDate: laws.depositDate,
					legislature: laws.legislature,
					initiator: laws.initiator,
					theme: laws.theme
				})
				.from(laws)
				.where(whereClause)
				.orderBy(desc(laws.depositDate))
				.limit(limit)
				.offset(offset)
		]);

	// Load tags for displayed laws (batch, avoids N+1 queries)
	// Pattern: charge tous les tags des lois affichées en une seule requête,
	// puis regroupe par lawId côté application
	const lawIds = lawsList.map((l) => l.id);
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

	// Group tags by law ID
	const tagsByLawId = new Map<string, { slug: string; name: string; color: string | null }[]>();
	for (const row of lawTagsData) {
		if (!tagsByLawId.has(row.lawId)) {
			tagsByLawId.set(row.lawId, []);
		}
		tagsByLawId.get(row.lawId)!.push({ slug: row.slug, name: row.name, color: row.color });
	}

	const lawsWithTags = lawsList.map((law) => ({
		...law,
		tags: tagsByLawId.get(law.id) ?? []
	}));

	return {
		laws: lawsWithTags,
		types: typeOptions.map((t) => t.type).filter(Boolean) as string[],
		statuses: statusOptions.map((s) => s.status).filter(Boolean) as string[],
		availableTags,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			search,
			type,
			status,
			tag,
			legislature
		}
	};
};
