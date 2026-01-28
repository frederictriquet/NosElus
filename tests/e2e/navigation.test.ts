import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
	test('should navigate to homepage', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL('/');
	});

	test('should have correct viewport meta tag', async ({ page }) => {
		await page.goto('/');
		const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
		expect(viewportMeta).toContain('width=device-width');
	});

	test('should load without console errors', async ({ page }) => {
		const consoleErrors: string[] = [];

		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		await page.goto('/');

		// Wait for page to be fully loaded
		await page.waitForLoadState('networkidle');

		// Check for console errors
		expect(consoleErrors).toEqual([]);
	});
});
