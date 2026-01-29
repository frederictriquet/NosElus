import type { PageServerLoad } from './$types';
import { db, scrutins, votes, actors, organs } from '$lib/server/db';
import { eq, count } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	// Get scrutin
	const [scrutin] = await db
		.select()
		.from(scrutins)
		.where(eq(scrutins.id, params.id));

	if (!scrutin) {
		throw error(404, { message: 'Scrutin non trouvé' });
	}

	// Get votes with actor and group info
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
		.where(eq(votes.scrutinId, params.id));

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
		scrutin,
		votesByPosition,
		totalVotes: scrutinVotes.length
	};
};
