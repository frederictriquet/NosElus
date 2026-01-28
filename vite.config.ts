import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString())
	}
});
