/**
 * Synchronise les couleurs des groupes PO_GP_* (nosdeputes.fr) vers les groupes AN (PO...)
 *
 * Ce script trouve les correspondances entre les groupes des deux sources
 * et copie les couleurs vers les groupes AN.
 *
 * Usage: npx tsx scripts/etl/sync-group-colors.ts
 */

import 'dotenv/config';
import { db, organs } from '../../src/lib/server/db';
import { eq, and, like, notLike, isNull } from 'drizzle-orm';
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

// Mapping des shortNames nosdeputes.fr -> AN
// NOTE: Ce mapping est nécessaire car les deux sources utilisent des noms différents
// pour les mêmes groupes. Idéalement, ce mapping devrait être stocké en DB
// ou généré dynamiquement par fuzzy matching.
const SHORTNAME_ALIASES: Record<string, string[]> = {
	// 17e législature
	MODEM: ['Dem'],
	ECO: ['Ecolo - NUPES', 'EcoS'],
	LFI: ['LFI - NUPES', 'LFI-NFP'],
	REN: ['RE', 'EPR'],
	GDR: ['GDR - NUPES'],
	// 15e législature
	LREM: ['LaREM'],
	SRC: ['SOC'],
	// 14e législature
	SER: ['SOC'],
	ECOLO: ['Écolo'],
	// 13e législature
	'S.R.C.': ['SRC']
};

async function main() {
	console.log('='.repeat(60));
	console.log('Synchronisation des couleurs de groupes');
	console.log('='.repeat(60));
	console.log('');

	// Récupérer tous les groupes
	const allGroups = await db
		.select({
			id: organs.id,
			shortName: organs.shortName,
			name: organs.name,
			legislature: organs.legislature,
			color: organs.color
		})
		.from(organs)
		.where(eq(organs.type, 'GP'));

	const ndGroups = allGroups.filter((g) => g.id.startsWith('PO_GP_'));
	const anGroups = allGroups.filter((g) => !g.id.startsWith('PO_GP_'));

	console.log(`Groupes NosDéputés (PO_GP_*): ${ndGroups.length}`);
	console.log(`Groupes AN (PO...): ${anGroups.length}`);
	console.log('');

	let updated = 0;
	let notFound = 0;
	let alreadyHasColor = 0;

	for (const nd of ndGroups) {
		if (!nd.color) continue; // Pas de couleur à transférer

		// Trouver le groupe AN correspondant
		const possibleNames = [nd.shortName, ...(SHORTNAME_ALIASES[nd.shortName || ''] || [])];

		const matches = anGroups.filter(
			(an) => an.legislature === nd.legislature && possibleNames.includes(an.shortName || '')
		);

		if (matches.length === 0) {
			console.log(`⚠ Pas de correspondance: ${nd.id} (${nd.shortName}, leg ${nd.legislature})`);
			notFound++;
			continue;
		}

		for (const match of matches) {
			if (match.color) {
				// Le groupe AN a déjà une couleur
				alreadyHasColor++;
				continue;
			}

			// Mettre à jour la couleur
			await db.update(organs).set({ color: nd.color }).where(eq(organs.id, match.id));

			console.log(`✓ ${match.id} (${match.shortName}) <- ${nd.color} (depuis ${nd.id})`);
			updated++;
		}
	}

	// Chercher aussi les groupes AN sans couleur pour les législatures 12-14
	console.log('\n--- Groupes AN sans couleur (législatures 12-14) ---\n');

	const anWithoutColor = anGroups.filter(
		(g) => !g.color && ['12', '13', '14'].includes(g.legislature || '')
	);

	for (const g of anWithoutColor) {
		// Chercher une couleur dans les groupes ND avec un nom similaire
		const possibleNdNames = Object.entries(SHORTNAME_ALIASES)
			.filter(([_, aliases]) => aliases.includes(g.shortName || ''))
			.map(([ndName, _]) => ndName);

		possibleNdNames.push(g.shortName || '');

		const ndMatch = ndGroups.find(
			(nd) =>
				nd.color && nd.legislature === g.legislature && possibleNdNames.includes(nd.shortName || '')
		);

		if (ndMatch) {
			await db.update(organs).set({ color: ndMatch.color }).where(eq(organs.id, g.id));
			console.log(`✓ ${g.id} (${g.shortName}, leg ${g.legislature}) <- ${ndMatch.color}`);
			updated++;
		} else {
			// Pas de couleur disponible depuis nosdeputes.fr - laisser null
			console.log(
				`✗ Sans couleur: ${g.id} (${g.shortName}, leg ${g.legislature}) - aucune source disponible`
			);
		}
	}

	console.log('\n' + '='.repeat(60));
	console.log('RÉSUMÉ');
	console.log('='.repeat(60));
	console.log(`  Couleurs transférées: ${updated}`);
	console.log(`  Déjà avec couleur: ${alreadyHasColor}`);
	console.log(`  Sans correspondance: ${notFound}`);
	console.log('='.repeat(60));

	await notifyETLComplete(
		'sync-group-colors',
		{
			total: updated + alreadyHasColor + notFound,
			inserted: 0,
			updated,
			skipped: alreadyHasColor + notFound,
			errors: 0
		},
		{ dryRun: process.argv.includes('--dry-run') }
	);

	process.exit(0);
}

main();
