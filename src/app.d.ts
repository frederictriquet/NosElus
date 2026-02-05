// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			periods: {
				an: string | null;
				senat: string | null;
				pe: string | null;
			};
			adminAuthenticated: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	const __BUILD_TIMESTAMP__: string;
}

export {};
