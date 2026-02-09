import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { verifyAdminSessionToken } from '$lib/server/auth';

// Noms des cookies pour les périodes par chambre
const PERIOD_COOKIES = {
	an: 'noselus-period-an',
	senat: 'noselus-period-senat',
	pe: 'noselus-period-pe'
} as const;

// Routes globales (pas spécifiques à une chambre) qui ne doivent pas être redirigées
const GLOBAL_ROUTES = ['/stats/data-quality'];

// Redirections des anciennes URLs vers les nouvelles
const REDIRECTS: Record<string, string> = {
	'/deputes': '/an/deputes',
	'/scrutins': '/an/scrutins',
	'/groupes': '/an/groupes',
	'/stats': '/an/stats',
	'/carte': '/an/carte',
	'/compare': '/an/compare',
	'/senateurs': '/senat/senateurs',
	'/eurodeputes': '/pe/eurodeputes'
};

export const handle: Handle = async ({ event, resolve }) => {
	// Lire les cookies de périodes et les exposer dans locals
	event.locals.periods = {
		an: event.cookies.get(PERIOD_COOKIES.an) || null,
		senat: event.cookies.get(PERIOD_COOKIES.senat) || null,
		pe: event.cookies.get(PERIOD_COOKIES.pe) || null
	};

	// Vérifier l'authentification admin
	const adminSessionToken = event.cookies.get('noselus-admin-session');
	event.locals.adminAuthenticated = adminSessionToken
		? verifyAdminSessionToken(adminSessionToken)
		: false;

	const pathname = event.url.pathname;

	// Vérifier les redirections exactes
	if (REDIRECTS[pathname]) {
		// Conserver les query params
		const search = event.url.search;
		throw redirect(301, REDIRECTS[pathname] + search);
	}

	// Vérifier les redirections de sous-chemins (ex: /deputes/PA123 -> /an/deputes/PA123)
	for (const [oldPath, newPath] of Object.entries(REDIRECTS)) {
		if (pathname.startsWith(oldPath + '/')) {
			// Ne pas rediriger les routes globales (ex: /stats/data-quality)
			if (GLOBAL_ROUTES.some((route) => pathname.startsWith(route))) {
				continue;
			}
			const subPath = pathname.slice(oldPath.length);
			const search = event.url.search;
			throw redirect(301, newPath + subPath + search);
		}
	}

	// Resolve the request
	const response = await resolve(event);

	// Add security headers (CSP is handled by SvelteKit via svelte.config.js with nonces)
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	return response;
};
