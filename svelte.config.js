import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use adapter-node for Docker/production deployments
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),

		// Content Security Policy with nonces for inline scripts
		// SvelteKit automatically generates unique nonces for each request
		csp: {
			directives: {
				'default-src': ['self'],
				'img-src': [
					'self',
					'https://www.assemblee-nationale.fr',
					'https://www.nosdeputes.fr',
					'https://www.senat.fr',
					'https://www.europarl.europa.eu',
					'data:'
				],
				'style-src': ['self', 'unsafe-inline'], // Required for Svelte scoped styles
				'script-src': ['self'], // Nonces are automatically added by SvelteKit
				'connect-src': ['self'],
				'font-src': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
