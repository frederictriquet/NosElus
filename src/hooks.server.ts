import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

// Noms des cookies pour les périodes par chambre
const PERIOD_COOKIES = {
	an: 'noselus-period-an',
	senat: 'noselus-period-senat',
	pe: 'noselus-period-pe'
} as const;

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
			const subPath = pathname.slice(oldPath.length);
			const search = event.url.search;
			throw redirect(301, newPath + subPath + search);
		}
	}

	// Resolve the request
	const response = await resolve(event);

	// Add security headers
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	// Content Security Policy
	// - default-src 'self': Only load resources from same origin by default
	// - img-src: Allow images from self, official sources (AN, Sénat, EP) and data: URIs for inline SVG
	// - style-src 'unsafe-inline': Required for Svelte scoped styles
	// - script-src 'self': Only scripts from same origin
	// - connect-src 'self': Only API calls to same origin
	// - font-src 'self': Only fonts from same origin
	// - frame-ancestors 'none': Prevent embedding in iframes (modern equivalent of X-Frame-Options)
	const csp = [
		"default-src 'self'",
		"img-src 'self' https://www.assemblee-nationale.fr https://www.senat.fr https://www.europarl.europa.eu data:",
		"style-src 'self' 'unsafe-inline'",
		"script-src 'self'",
		"connect-src 'self'",
		"font-src 'self'",
		"frame-ancestors 'none'"
	].join('; ');

	response.headers.set('Content-Security-Policy', csp);

	return response;
};
