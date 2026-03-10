import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { sveltekitOG } from '@ethercorps/sveltekit-og/plugin';

export default defineConfig({
	plugins: [sveltekit(), sveltekitOG({ esmImport: false })],
	define: {
		__BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString())
	}
});
