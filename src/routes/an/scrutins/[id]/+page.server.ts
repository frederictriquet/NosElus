import type { PageServerLoad } from './$types';
import {
	db,
	scrutins,
	votes,
	actors,
	organs,
	laws,
	lawSummaries,
	lawTags,
	tags
} from '$lib/server/db';
import { eq, count } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getTightLabel, DEFAULT_TIGHT_THRESHOLD } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params }) => {
	// Get scrutin info
	const [scrutin] = await db.select().from(scrutins).where(eq(scrutins.id, params.id));

	if (!scrutin) {
		throw error(404, { message: 'Scrutin non trouvé' });
	}

	// Get related law if exists (with AI summary)
	const loadRelatedLaw = async () => {
		if (!scrutin.lawId) return null;

		const [law] = await db
			.select({
				id: laws.id,
				title: laws.title,
				shortTitle: laws.shortTitle,
				type: laws.type,
				status: laws.status,
				description: laws.description,
				sourceUrl: laws.sourceUrl,
				// AI-generated summary
				summary: lawSummaries.summary,
				summaryModel: lawSummaries.model
			})
			.from(laws)
			.leftJoin(lawSummaries, eq(laws.id, lawSummaries.lawId))
			.where(eq(laws.id, scrutin.lawId));

		if (!law) return null;

		// Get tags for this law
		const lawTagsList = await db
			.select({
				slug: tags.slug,
				name: tags.name,
				color: tags.color
			})
			.from(lawTags)
			.innerJoin(tags, eq(lawTags.tagSlug, tags.slug))
			.where(eq(lawTags.lawId, scrutin.lawId));

		return {
			...law,
			tags: lawTagsList
		};
	};

	// Get votes breakdown by group
	const loadGroupBreakdown = async () => {
		const groupVotes = await db
			.select({
				groupId: votes.groupId,
				groupName: organs.name,
				groupShortName: organs.shortName,
				groupColor: organs.color,
				position: votes.position,
				count: count()
			})
			.from(votes)
			.leftJoin(organs, eq(votes.groupId, organs.id))
			.where(eq(votes.scrutinId, params.id))
			.groupBy(votes.groupId, organs.name, organs.shortName, organs.color, votes.position);

		// Aggregate by group
		const groupMap = new Map<
			string,
			{
				id: string;
				name: string;
				shortName: string | null;
				color: string | null;
				pour: number;
				contre: number;
				abstention: number;
				nonVotant: number;
				total: number;
			}
		>();

		for (const row of groupVotes) {
			if (!row.groupId) continue;

			if (!groupMap.has(row.groupId)) {
				groupMap.set(row.groupId, {
					id: row.groupId,
					name: row.groupName || 'Groupe inconnu',
					shortName: row.groupShortName,
					color: row.groupColor,
					pour: 0,
					contre: 0,
					abstention: 0,
					nonVotant: 0,
					total: 0
				});
			}

			const group = groupMap.get(row.groupId)!;
			const position = row.position?.toLowerCase() || '';

			if (position === 'pour') {
				group.pour += row.count;
			} else if (position === 'contre') {
				group.contre += row.count;
			} else if (position === 'abstention') {
				group.abstention += row.count;
			} else {
				group.nonVotant += row.count;
			}
			group.total += row.count;
		}

		return Array.from(groupMap.values()).sort((a, b) => b.total - a.total);
	};

	// Get individual votes
	const loadVoters = async () => {
		return await db
			.select({
				actorId: votes.actorId,
				actorName: actors.fullName,
				actorPhoto: actors.photoUrl,
				position: votes.position,
				groupName: organs.shortName,
				groupFullName: organs.name,
				groupColor: organs.color
			})
			.from(votes)
			.innerJoin(actors, eq(votes.actorId, actors.id))
			.leftJoin(organs, eq(votes.groupId, organs.id))
			.where(eq(votes.scrutinId, params.id))
			.orderBy(actors.lastName)
			.limit(100);
	};

	// Calculate tight vote metadata
	const margin = scrutin.margin;
	const isTightVote = margin <= DEFAULT_TIGHT_THRESHOLD;
	const tightLabel = getTightLabel(margin);

	return {
		// Synchronous data
		scrutin,
		margin,
		isTightVote,
		tightLabel,
		// Streamed data
		relatedLaw: loadRelatedLaw(),
		groupBreakdown: loadGroupBreakdown(),
		voters: loadVoters()
	};
};
