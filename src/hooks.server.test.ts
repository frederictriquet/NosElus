import { describe, it, expect } from 'vitest';
import { handle } from './hooks.server';

/**
 * Tests d'intégration pour les security headers HTTP
 *
 * Ces tests vérifient que tous les headers de sécurité recommandés
 * sont présents dans les réponses HTTP de l'application.
 */

describe('Security Headers', () => {
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

	it('should set X-Frame-Options header', async () => {
		const event = createMockEvent();
		const response = await handle({
			event: event as any,
			resolve: mockResolve
		});

		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('should set X-Content-Type-Options header', async () => {
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

	it('should set Content-Security-Policy header', async () => {
		const event = createMockEvent();
		const response = await handle({
			event: event as any,
			resolve: mockResolve
		});

		const csp = response.headers.get('Content-Security-Policy');
		expect(csp).toBeTruthy();

		// Verify key CSP directives
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("img-src 'self' https://www.assemblee-nationale.fr");
		expect(csp).toContain("style-src 'self' 'unsafe-inline'");
		expect(csp).toContain("script-src 'self'");
		expect(csp).toContain("frame-ancestors 'none'");
	});

	it('should allow images from official sources', async () => {
		const event = createMockEvent();
		const response = await handle({
			event: event as any,
			resolve: mockResolve
		});

		const csp = response.headers.get('Content-Security-Policy');

		// Check all whitelisted image sources
		expect(csp).toContain('https://www.assemblee-nationale.fr');
		expect(csp).toContain('https://www.senat.fr');
		expect(csp).toContain('https://www.europarl.europa.eu');
		expect(csp).toContain('data:'); // For inline SVG
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
			expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
		}
	});
});
