import type { PageServerLoad } from './$types';
import { db, scrutins, votes, actors, organs } from '$lib/server/db';
import { eq, and, like } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Get scrutin (synchronous - needed for 404 and page header)
	// Ensure it's a PE scrutin
	const [scrutin] = await db
		.select()
		.from(scrutins)
		.where(and(eq(scrutins.id, params.id), like(scrutins.legislature, 'PE-%')));

	if (!scrutin) {
		throw error(404, { message: 'Scrutin non trouvé' });
	}

	// Loader for vote details (streamed)
	const loadVoteDetails = async () => {
		// Get votes with actor and group info (only French MEPs = chamber PE)
		const scrutinVotes = await db
			.select({
				id: votes.id,
				position: votes.position,
				actorId: actors.id,
				actorName: actors.fullName,
				actorPhoto: actors.photoUrl,
				groupId: organs.id,
				groupShortName: organs.shortName,
				groupColor: organs.color
			})
			.from(votes)
			.innerJoin(actors, eq(votes.actorId, actors.id))
			.leftJoin(organs, eq(votes.groupId, organs.id))
			.where(and(eq(votes.scrutinId, params.id), eq(actors.chamber, 'PE')));

		// Group votes by position
		const votesByPosition = {
			pour: [] as typeof scrutinVotes,
			contre: [] as typeof scrutinVotes,
			abstention: [] as typeof scrutinVotes,
			'non-votant': [] as typeof scrutinVotes
		};

		for (const vote of scrutinVotes) {
			const pos = vote.position as keyof typeof votesByPosition;
			if (pos in votesByPosition) {
				votesByPosition[pos].push(vote);
			}
		}

		return {
			votesByPosition,
			totalVotes: scrutinVotes.length
		};
	};

	return {
		scrutin,
		// Streamed data
		voteDetails: loadVoteDetails()
	};
};
