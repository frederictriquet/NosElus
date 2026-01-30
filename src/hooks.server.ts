import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

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

	return resolve(event);
};
