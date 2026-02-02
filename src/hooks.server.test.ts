import { describe, it, expect } from 'vitest';
import { handle } from './hooks.server';

/**
 * Tests d'intégration pour les security headers HTTP
 *
 * Ces tests vérifient que les headers de sécurité (hors CSP) sont présents.
 * La CSP est gérée par SvelteKit via svelte.config.js avec nonces automatiques.
 */

describe('Security Headers (hooks.server.ts)', () => {
	// Mock event and resolve function
	const createMockEvent = (pathname: string = '/') => ({
		url: new URL(`http://localhost${pathname}`),
		cookies: {
			get: () => null
		},
		locals: {} as any,
		request: new Request(`http://localhost${pathname}`)
	});

	const mockResolve = async () => new Response('OK', {
		status: 200,
		headers: new Headers({ 'Content-Type': 'text/html' })
	});

	it('should set X-Frame-Options header to DENY', async () => {
		const event = createMockEvent();
		const response = await handle({
			event: event as any,
			resolve: mockResolve
		});

		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('should set X-Content-Type-Options header to nosniff', async () => {
		const event = createMockEvent();
		const response = await handle({
			event: event as any,
			resolve: mockResolve
		});

		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('should set Referrer-Policy header', async () => {
		const event = createMockEvent();
		const response = await handle({
			event: event as any,
			resolve: mockResolve
		});

		expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
	});

	it('should set all security headers on any route', async () => {
		const routes = ['/', '/an/deputes', '/pe/eurodeputes', '/senat/senateurs'];

		for (const route of routes) {
			const event = createMockEvent(route);
			const response = await handle({
				event: event as any,
				resolve: mockResolve
			});

			expect(response.headers.get('X-Frame-Options')).toBe('DENY');
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
		}
	});
});

/**
 * Note: CSP is now configured in svelte.config.js with automatic nonce generation.
 * Testing CSP requires E2E tests with the full SvelteKit server running.
 * See tests/e2e/ for CSP verification in a real browser context.
 */
