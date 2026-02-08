/**
 * Seed political positions for European Parliament groups
 *
 * Migrates hardcoded EU_GROUP_POSITIONS to database (organs.political_position).
 * Positions are based on Chapel Hill Expert Survey and political science consensus.
 *
 * Scale: 0 (extreme left) - 10 (extreme right)
 *
 * Usage: npx tsx scripts/etl/seed-pe-positions.ts
 */

import { db, organs } from '../../src/lib/server/db';
import { eq, and } from 'drizzle-orm';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

interface GroupPosition {
	shortName: string;
	position: number;
	comment?: string;
}

/**
 * Political positions for European Parliament groups
 * Based on Chapel Hill Expert Survey and VoteWatch Europe
 *
 * Scale: 0 (extreme left) - 10 (extreme right), 999 = Non-inscrits
 */
const PE_GROUP_POSITIONS: GroupPosition[] = [
	// Extrême gauche
	{ shortName: 'GUE/NGL', position: 1.5, comment: 'European United Left/Nordic Green Left' },
	{ shortName: 'The Left', position: 1.5, comment: 'The Left group (post-2024)' },

	// Gauche
	{ shortName: 'S&D', position: 3.5, comment: 'Progressive Alliance of Socialists and Democrats' },
	{ shortName: 'PSE', position: 3.5, comment: 'Party of European Socialists (ancien nom)' },
	{ shortName: 'Verts/ALE', position: 3.0, comment: 'Greens/European Free Alliance' },
	{ shortName: 'Greens', position: 3.0, comment: 'The Greens' },

	// Centre
	{ shortName: 'RE', position: 5.5, comment: 'Renew Europe' },
	{
		shortName: 'ALDE',
		position: 5.5,
		comment: 'Alliance of Liberals and Democrats for Europe (ancien nom)'
	},
	{ shortName: 'IND/DEM', position: 5.0, comment: 'Independence/Democracy Group' },
	{ shortName: 'EFDD', position: 5.5, comment: 'Europe of Freedom and Direct Democracy' },

	// Centre-droit
	{ shortName: 'PPE', position: 6.5, comment: "European People's Party" },
	{ shortName: 'PPE-DE', position: 6.5, comment: 'EPP-ED (ancien nom)' },

	// Droite
	{ shortName: 'ECR', position: 7.5, comment: 'European Conservatives and Reformists' },

	// Extrême droite
	{ shortName: 'ID', position: 8.5, comment: 'Identity and Democracy' },
	{ shortName: 'ENF', position: 8.5, comment: 'Europe of Nations and Freedom (prédécesseur ID)' },
	{ shortName: 'EFD', position: 8.0, comment: 'Europe of Freedom and Democracy' },
	{ shortName: 'ITS', position: 8.5, comment: 'Identity, Tradition, Sovereignty' },
	{
		shortName: 'Patriots for Europe Group',
		position: 8.5,
		comment: 'Patriots for Europe (post-2024)'
	},
	{ shortName: 'Europe of Sovereign Nations Group', position: 9.0, comment: 'ESN (post-2024)' }
];

/**
 * Update political positions in database
 */
async function seedPePositions(): Promise<{
	updated: number;
	notFound: number;
	unchanged: number;
}> {
	let updated = 0;
	let notFound = 0;
	let unchanged = 0;

	for (const { shortName, position, comment } of PE_GROUP_POSITIONS) {
		// Find matching PE groups by shortName
		const matchingGroups = await db
			.select({
				id: organs.id,
				shortName: organs.shortName,
				name: organs.name,
				politicalPosition: organs.politicalPosition
			})
			.from(organs)
			.where(and(eq(organs.chamber, 'PE'), eq(organs.type, 'GP'), eq(organs.shortName, shortName)));

		if (matchingGroups.length === 0) {
			console.log(`  ✗ No PE group found with shortName: ${shortName}`);
			notFound++;
			continue;
		}

		// Update all matching groups
		for (const group of matchingGroups) {
			if (group.politicalPosition === position) {
				console.log(`  = ${group.id} (${group.shortName}) already has position ${position}`);
				unchanged++;
			} else {
				await db.update(organs).set({ politicalPosition: position }).where(eq(organs.id, group.id));

				const oldPos = group.politicalPosition ?? 'null';
				console.log(
					`  ✓ ${group.id} (${group.shortName}): ${oldPos} → ${position}${comment ? ' (' + comment + ')' : ''}`
				);
				updated++;
			}
		}
	}

	return { updated, notFound, unchanged };
}

async function main() {
	console.log('='.repeat(70));
	console.log('NosElus ETL - Seed Political Positions (PE Groups)');
	console.log('='.repeat(70));
	console.log('');
	console.log('Source: Chapel Hill Expert Survey + Political Science Consensus');
	console.log('');

	console.log('--- Parlement Européen ---\n');
	const result = await seedPePositions();

	console.log('\n' + '='.repeat(70));
	console.log('RÉSUMÉ');
	console.log('='.repeat(70));
	console.log(`  Positions mises à jour: ${result.updated}`);
	console.log(`  Positions inchangées: ${result.unchanged}`);
	console.log(`  Groupes non trouvés: ${result.notFound}`);
	console.log('='.repeat(70));

	if (result.notFound > 0) {
		console.log('\nℹ️  Groupes non trouvés: groupes historiques ou noms alternatifs');
		console.log('   Ces positions seront utilisées quand ces groupes existeront en DB');
	}

	await notifyETLComplete('seed-pe-positions', {
		total: result.updated + result.notFound + result.unchanged,
		inserted: 0,
		updated: result.updated,
		skipped: result.unchanged + result.notFound,
		errors: 0
	});

	process.exit(0);
}

main();
