import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { sveltekitOG } from '@ethercorps/sveltekit-og/plugin';

export default defineConfig(({ mode }) => ({
	plugins: [
		sveltekit(),
		// esmImport:true en dev (Vite ESM natif), false en prod (adapter-node/Alpine CJS)
		sveltekitOG({ esmImport: mode === 'development' })
	],
	define: {
		__BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString())
	}
}));
