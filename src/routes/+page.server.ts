import type { PageServerLoad } from './$types';
import { db, actors, scrutins, organs } from '$lib/server/db';
import { count, desc, eq, and, like, notLike } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Statistiques par chambre - requêtes parallèles
	const [
		[anDeputies],
		[anGroups],
		[senatSenators],
		[senatGroups],
		[peMeps],
		[peGroups],
		[peScrutins],
		[totalScrutins],
		recentScrutins
	] = await Promise.all([
		// AN
		db.select({ value: count() }).from(actors).where(eq(actors.chamber, 'AN')),
		db
			.select({ value: count() })
			.from(organs)
			.where(and(eq(organs.type, 'GP'), eq(organs.chamber, 'AN'))),
		// Sénat
		db.select({ value: count() }).from(actors).where(eq(actors.chamber, 'SENAT')),
		db
			.select({ value: count() })
			.from(organs)
			.where(and(eq(organs.type, 'GP'), eq(organs.chamber, 'SENAT'))),
		// PE
		db.select({ value: count() }).from(actors).where(eq(actors.chamber, 'PE')),
		db
			.select({ value: count() })
			.from(organs)
			.where(and(eq(organs.type, 'GP'), eq(organs.chamber, 'PE'))),
		db.select({ value: count() }).from(scrutins).where(like(scrutins.legislature, 'PE-%')),
		// Total scrutins
		db.select({ value: count() }).from(scrutins),
		// Derniers scrutins
		db
			.select({
				id: scrutins.id,
				title: scrutins.title,
				date: scrutins.date,
				result: scrutins.result,
				totalVoters: scrutins.totalVoters,
				totalFor: scrutins.totalFor,
				totalAgainst: scrutins.totalAgainst,
				totalAbstention: scrutins.totalAbstention
			})
			.from(scrutins)
			.where(notLike(scrutins.legislature, 'PE-%'))
			.orderBy(desc(scrutins.date), desc(scrutins.number))
			.limit(5)
	]);

	// Scrutins AN = total - PE
	const anScrutinsCount = totalScrutins.value - peScrutins.value;

	return {
		chambers: {
			an: {
				deputies: anDeputies.value,
				scrutins: anScrutinsCount > 0 ? anScrutinsCount : 0,
				groups: anGroups.value
			},
			senat: {
				senators: senatSenators.value,
				groups: senatGroups.value
			},
			pe: {
				meps: peMeps.value,
				scrutins: peScrutins.value,
				groups: peGroups.value
			}
		},
		recentScrutins
	};
};
