import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdminPasswordConfigured } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Vérifier que le mot de passe admin est configuré
	if (!isAdminPasswordConfigured()) {
		return {
			passwordConfigured: false,
			authenticated: false
		};
	}

	// Si on est sur /admin (page de login), ne pas rediriger
	if (url.pathname === '/admin') {
		return {
			passwordConfigured: true,
			authenticated: locals.adminAuthenticated
		};
	}

	// Pour les autres pages admin, vérifier l'authentification
	if (!locals.adminAuthenticated) {
		throw redirect(303, '/admin');
	}

	return {
		passwordConfigured: true,
		authenticated: true
	};
};
