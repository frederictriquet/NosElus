import type { PageServerLoad } from './$types';
import { db, actors, mandates, organs, actorStats, votes, scrutins } from '$lib/server/db';
import { eq, and, sql, desc, count, inArray, type SQL } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getRenouvellementDates } from '$lib/server/periods/senat-renouvellements';
import { buildMandateOverlapConditions, type PeriodDates } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params, locals }) => {
	const renouvellement = locals.periods.senat;

	// Get actor
	const [actor] = await db
		.select()
		.from(actors)
		.where(and(eq(actors.id, params.id), eq(actors.chamber, 'SENAT')));

	if (!actor) {
		throw error(404, { message: 'Sénateur non trouvé' });
	}

	// Get renouvellement dates for filtering
	const periodDates: PeriodDates | null =
		renouvellement && renouvellement !== 'all'
			? await getRenouvellementDates(renouvellement)
			: null;

	// Check if senator had an active mandate during this renouvellement period
	const checkMandate = async (): Promise<boolean> => {
		if (!periodDates) return true;

		const [mandate] = await db
			.select({ id: mandates.id })
			.from(mandates)
			.where(
				and(
					eq(mandates.actorId, params.id),
					eq(mandates.type, 'senateur'),
					...buildMandateOverlapConditions(periodDates)
				)
			)
			.limit(1);

		return !!mandate;
	};

	const hadMandateDuringPeriod = await checkMandate();

	// Build vote conditions helper (filter by date range if renouvellement specified)
	const buildVoteConditions = (): SQL[] => {
		const conditions: SQL[] = [eq(votes.actorId, params.id)];
		if (periodDates) {
			conditions.push(sql`${scrutins.date} >= ${periodDates.start}`);
			if (periodDates.end) {
				conditions.push(sql`${scrutins.date} <= ${periodDates.end}`);
			}
		}
		return conditions;
	};

	// Build mandate filter conditions using shared helper
	const buildMandateConditions = (): SQL[] => {
		const conditions: SQL[] = [eq(mandates.actorId, params.id)];
		conditions.push(...buildMandateOverlapConditions(periodDates));
		return conditions;
	};

	// Get senator's current group (most recent GP mandate, filtered by period)
	const groupConditions = buildMandateConditions();
	const [senatorGroup] = await db
		.select({
			groupId: organs.id,
			groupName: organs.name,
			groupShortName: organs.shortName,
			groupColor: organs.color,
			constituency: mandates.constituency
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(and(...groupConditions, eq(organs.type, 'GP'), eq(organs.chamber, 'SENAT')))
		.orderBy(desc(mandates.startDate))
		.limit(1);

	// Get all mandates for this senator (filtered by period)
	const senatorMandates = await db
		.select({
			id: mandates.id,
			organId: mandates.organId,
			organName: organs.name,
			organShortName: organs.shortName,
			organType: organs.type,
			organColor: organs.color,
			startDate: mandates.startDate,
			endDate: mandates.endDate,
			quality: mandates.quality,
			legislature: mandates.legislature,
			constituency: mandates.constituency
		})
		.from(mandates)
		.innerJoin(organs, eq(mandates.organId, organs.id))
		.where(and(...buildMandateConditions()))
		.orderBy(desc(mandates.startDate));

	// Get senator mandate (type 'senateur') for mandate dates (filtered by period)
	const senateurMandateConditions = buildMandateConditions();
	senateurMandateConditions.push(eq(mandates.type, 'senateur'));
	const senatorMandate = await db
		.select({
			startDate: mandates.startDate,
			endDate: mandates.endDate,
			constituency: mandates.constituency
		})
		.from(mandates)
		.where(and(...senateurMandateConditions))
		.orderBy(desc(mandates.startDate))
		.limit(1);

	// Get activity stats (try nossenateurs first, then senat official source)
	let [stats] = await db
		.select()
		.from(actorStats)
		.where(and(eq(actorStats.actorId, params.id), eq(actorStats.source, 'nossenateurs')));

	if (!stats) {
		[stats] = await db
			.select()
			.from(actorStats)
			.where(and(eq(actorStats.actorId, params.id), eq(actorStats.source, 'senat')));
	}

	// Loader for group alignment rate
	const loadGroupAlignment = async () => {
		// Get all votes for this senator with their group at time of vote (filtered by period)
		const senatorVotes = await db
			.select({
				scrutinId: votes.scrutinId,
				position: votes.position,
				groupId: votes.groupId
			})
			.from(votes)
			.innerJoin(scrutins, eq(votes.scrutinId, scrutins.id))
			.where(and(...buildVoteConditions()));

		if (senatorVotes.length === 0) return null;

		// Get unique group IDs from senator's votes
		const groupIds = [...new Set(senatorVotes.map((v) => v.groupId).filter(Boolean))] as string[];
		if (groupIds.length === 0) return null;

		// Get all group votes for the relevant scrutins and groups
		const scrutinIds = [...new Set(senatorVotes.map((v) => v.scrutinId))];

		const groupVoteCounts = await db
			.select({
				scrutinId: votes.scrutinId,
				groupId: votes.groupId,
				position: votes.position,
				cnt: count()
			})
			.from(votes)
			.where(and(inArray(votes.scrutinId, scrutinIds), inArray(votes.groupId, groupIds)))
			.groupBy(votes.scrutinId, votes.groupId, votes.position);

		// Build map of majority position per scrutin per group
		const tempCounts: Record<string, Record<string, Record<string, number>>> = {};

		for (const row of groupVoteCounts) {
			if (!row.groupId) continue;
			if (!tempCounts[row.scrutinId]) {
				tempCounts[row.scrutinId] = {};
			}
			if (!tempCounts[row.scrutinId][row.groupId]) {
				tempCounts[row.scrutinId][row.groupId] = {};
			}
			tempCounts[row.scrutinId][row.groupId][row.position || ''] = row.cnt;
		}

		const groupMajority: Record<string, Record<string, string>> = {};
		for (const [scrutinId, groups] of Object.entries(tempCounts)) {
			groupMajority[scrutinId] = {};
			for (const [groupId, positions] of Object.entries(groups)) {
				let maxPos = 'pour';
				let maxCount = 0;
				for (const [pos, cnt] of Object.entries(positions)) {
					if (cnt > maxCount) {
						maxCount = cnt;
						maxPos = pos;
					}
				}
				groupMajority[scrutinId][groupId] = maxPos;
			}
		}

		// Calculate alignment
		let aligned = 0;
		let total = 0;

		for (const vote of senatorVotes) {
			if (!vote.groupId) continue;
			const majorityPos = groupMajority[vote.scrutinId]?.[vote.groupId];
			if (!majorityPos) continue;

			total++;
			if (vote.position === majorityPos) {
				aligned++;
			}
		}

		if (total === 0) return null;

		return {
			alignmentRate: Math.round((aligned / total) * 100),
			alignedVotes: aligned,
			totalVotes: total,
			dissidentVotes: total - aligned
		};
	};

	return {
		actor,
		group: senatorGroup || null,
		mandates: senatorMandates,
		senatorMandate: senatorMandate[0] || null,
		activityStats: stats || null,
		hadMandateDuringPeriod,
		periodDates,
		filters: {
			renouvellement
		},
		groupAlignment: loadGroupAlignment()
	};
};
