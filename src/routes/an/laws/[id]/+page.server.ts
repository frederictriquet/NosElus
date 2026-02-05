import type { PageServerLoad } from './$types';
import { db, laws, scrutins, lawSummaries } from '$lib/server/db';
import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getLawContributors } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params, locals }) => {
	const legislature = locals.periods.an;

	// Get law info
	const [law] = await db
		.select()
		.from(laws)
		.where(eq(laws.id, params.id));

	if (!law) {
		throw error(404, { message: 'Dossier législatif non trouvé' });
	}

	// Build conditions for related scrutins
	const buildScrutinConditions = (): SQL[] => {
		const conditions: SQL[] = [eq(scrutins.lawId, params.id)];
		if (legislature && legislature !== 'all') {
			conditions.push(eq(scrutins.legislature, legislature));
		}
		return conditions;
	};

	// Loader for related scrutins
	const loadRelatedScrutins = async () => {
		return await db
			.select({
				id: scrutins.id,
				number: scrutins.number,
				title: scrutins.title,
				date: scrutins.date,
				type: scrutins.type,
				category: scrutins.category,
				result: scrutins.result,
				totalVoters: scrutins.totalVoters,
				totalFor: scrutins.totalFor,
				totalAgainst: scrutins.totalAgainst,
				totalAbstention: scrutins.totalAbstention
			})
			.from(scrutins)
			.where(and(...buildScrutinConditions()))
			.orderBy(desc(scrutins.date));
	};

	// Loader for scrutin count
	const loadScrutinStats = async () => {
		const [totalResult] = await db
			.select({ value: count() })
			.from(scrutins)
			.where(and(...buildScrutinConditions()));

		const byCategory = await db
			.select({
				category: scrutins.category,
				count: count()
			})
			.from(scrutins)
			.where(and(...buildScrutinConditions()))
			.groupBy(scrutins.category);

		const byResult = await db
			.select({
				result: scrutins.result,
				count: count()
			})
			.from(scrutins)
			.where(and(...buildScrutinConditions()))
			.groupBy(scrutins.result);

		return {
			total: totalResult.value,
			byCategory,
			byResult
		};
	};

	// Loader for contributors (authors and cosignatories)
	const loadContributors = async () => {
		return getLawContributors(params.id);
	};

	// Loader for AI summary
	const loadSummary = async () => {
		const [summary] = await db
			.select({
				summary: lawSummaries.summary,
				tags: lawSummaries.tags,
				model: lawSummaries.model
			})
			.from(lawSummaries)
			.where(eq(lawSummaries.lawId, params.id));
		return summary || null;
	};

	// Build timeline events from law dates
	const buildTimeline = () => {
		const events: Array<{
			date: string;
			label: string;
			type: 'deposit' | 'adoption' | 'promulgation' | 'publication';
		}> = [];

		if (law.depositDate) {
			events.push({
				date: law.depositDate,
				label: 'Dépôt',
				type: 'deposit'
			});
		}

		if (law.adoptionDateAN) {
			events.push({
				date: law.adoptionDateAN,
				label: 'Adoption AN',
				type: 'adoption'
			});
		}

		if (law.adoptionDateSenat) {
			events.push({
				date: law.adoptionDateSenat,
				label: 'Adoption Sénat',
				type: 'adoption'
			});
		}

		if (law.promulgationDate) {
			events.push({
				date: law.promulgationDate,
				label: 'Promulgation',
				type: 'promulgation'
			});
		}

		if (law.publicationDate) {
			events.push({
				date: law.publicationDate,
				label: 'Publication JO',
				type: 'publication'
			});
		}

		// Sort by date
		events.sort((a, b) => a.date.localeCompare(b.date));

		return events;
	};

	return {
		// Synchronous data
		law,
		timeline: buildTimeline(),
		filters: {
			legislature
		},
		// Streamed data
		relatedScrutins: loadRelatedScrutins(),
		scrutinStats: loadScrutinStats(),
		contributors: loadContributors(),
		aiSummary: loadSummary()
	};
};
