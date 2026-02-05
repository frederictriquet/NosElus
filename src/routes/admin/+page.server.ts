import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';
import { verifyAdminPassword, generateAdminSessionToken } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { organs, adminSettings } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	// Si non authentifié, retourner uniquement le flag
	if (!locals.adminAuthenticated) {
		return {
			authenticated: false
		};
	}

	// Charger les groupes parlementaires
	const allGroups = await db
		.select({
			id: organs.id,
			uid: organs.uid,
			name: organs.name,
			shortName: organs.shortName,
			chamber: organs.chamber,
			legislature: organs.legislature,
			startDate: organs.startDate,
			endDate: organs.endDate,
			politicalPosition: organs.politicalPosition,
			color: organs.color
		})
		.from(organs)
		.where(eq(organs.type, 'GP'))
		.orderBy(organs.chamber, organs.politicalPosition);

	// Dédupliquer : quand plusieurs groupes partagent le même sigle
	// dans la même chambre/législature, garder le plus récent (start_date la plus tardive)
	const deduped = new Map<string, (typeof allGroups)[0]>();
	for (const group of allGroups) {
		const key = `${group.chamber}|${group.legislature || ''}|${group.shortName || group.id}`;
		const existing = deduped.get(key);
		if (!existing || (group.startDate && (!existing.startDate || group.startDate > existing.startDate))) {
			deduped.set(key, group);
		}
	}
	const groups = Array.from(deduped.values());

	// Extraire les mandatures disponibles par chambre
	const legislaturesPerChamber: Record<string, string[]> = {
		AN: [],
		PE: [],
		SENAT: []
	};
	for (const group of groups) {
		const chamber = group.chamber;
		const leg = group.legislature || '';
		if (chamber && legislaturesPerChamber[chamber] && leg && !legislaturesPerChamber[chamber].includes(leg)) {
			legislaturesPerChamber[chamber].push(leg);
		}
	}
	// Trier : numérique décroissant pour AN et PE, alphabétique pour SENAT
	legislaturesPerChamber.AN.sort((a, b) => Number(b) - Number(a));
	legislaturesPerChamber.PE.sort((a, b) => Number(b) - Number(a));
	legislaturesPerChamber.SENAT.sort();

	// Charger les settings ETL
	const settings = await db.select().from(adminSettings);

	// Transformer en objet clé-valeur
	const etlSettings: Record<string, boolean> = {};
	for (const setting of settings) {
		etlSettings[setting.key] = setting.value === 'true';
	}

	// Grouper par chambre
	const groupedByChamber = {
		AN: groups.filter((g) => g.chamber === 'AN'),
		PE: groups.filter((g) => g.chamber === 'PE'),
		SENAT: groups.filter((g) => g.chamber === 'SENAT')
	};

	return {
		authenticated: true,
		groups: groupedByChamber,
		legislatures: legislaturesPerChamber,
		etlSettings
	};
};

export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const password = data.get('password')?.toString();

		if (!password) {
			return fail(400, { error: 'Mot de passe requis' });
		}

		if (!verifyAdminPassword(password)) {
			return fail(401, { error: 'Mot de passe incorrect' });
		}

		// Générer et stocker le token de session
		const sessionToken = generateAdminSessionToken();
		cookies.set('noselus-admin-session', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24 // 24 heures
		});

		throw redirect(303, '/admin');
	},

	logout: async ({ cookies }) => {
		cookies.delete('noselus-admin-session', { path: '/' });
		throw redirect(303, '/admin');
	},

	updatePosition: async ({ request, locals }) => {
		if (!locals.adminAuthenticated) {
			return fail(401, { error: 'Non authentifié' });
		}

		const data = await request.formData();
		const organId = data.get('organId')?.toString();
		const position = data.get('position')?.toString();

		if (!organId || !position) {
			return fail(400, { error: 'Données manquantes' });
		}

		const positionNum = parseFloat(position);
		if (isNaN(positionNum) || positionNum < 0 || positionNum > 999) {
			return fail(400, { error: 'Position invalide (doit être entre 0 et 999)' });
		}

		try {
			await db
				.update(organs)
				.set({
					politicalPosition: positionNum,
					updatedAt: new Date()
				})
				.where(eq(organs.id, organId));

			return { success: true };
		} catch (error) {
			console.error('Error updating position:', error);
			return fail(500, { error: 'Erreur lors de la mise à jour' });
		}
	},

	toggleEtlProtection: async ({ request, locals }) => {
		if (!locals.adminAuthenticated) {
			return fail(401, { error: 'Non authentifié' });
		}

		const data = await request.formData();
		const chamber = data.get('chamber')?.toString();
		const enabled = data.get('enabled')?.toString() === 'true';

		if (!chamber || !['AN', 'PE', 'SENAT'].includes(chamber)) {
			return fail(400, { error: 'Chambre invalide' });
		}

		const key = `etl_protect_${chamber.toLowerCase()}`;

		try {
			// Vérifier si le setting existe
			const existing = await db
				.select()
				.from(adminSettings)
				.where(eq(adminSettings.key, key))
				.limit(1);

			if (existing.length > 0) {
				// Mettre à jour
				await db
					.update(adminSettings)
					.set({
						value: enabled ? 'true' : 'false',
						updatedAt: new Date()
					})
					.where(eq(adminSettings.key, key));
			} else {
				// Insérer
				await db.insert(adminSettings).values({
					key,
					value: enabled ? 'true' : 'false'
				});
			}

			return { success: true };
		} catch (error) {
			console.error('Error toggling ETL protection:', error);
			return fail(500, { error: 'Erreur lors de la mise à jour' });
		}
	}
} satisfies Actions;
