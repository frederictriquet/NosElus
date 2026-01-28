import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
	test('should load the homepage', async ({ page }) => {
		await page.goto('/');
		// Check page loaded successfully by verifying the layout wrapper exists
		const layoutWrapper = page.locator('.layout-wrapper');
		await expect(layoutWrapper).toBeVisible();
	});

	test('should display the footer with build timestamp', async ({ page }) => {
		await page.goto('/');

		const footer = page.locator('footer');
		await expect(footer).toBeVisible();

		const buildInfo = page.locator('.build-info');
		await expect(buildInfo).toBeVisible();
		await expect(buildInfo).toContainText('Built on');
	});

	test('should have proper page structure', async ({ page }) => {
		await page.goto('/');

		// Check layout wrapper exists
		const layoutWrapper = page.locator('.layout-wrapper');
		await expect(layoutWrapper).toBeVisible();

		// Check main content exists
		const mainContent = page.locator('.main-content');
		await expect(mainContent).toBeVisible();

		// Check footer exists
		const footer = page.locator('footer.footer');
		await expect(footer).toBeVisible();
	});
});
