import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
	// Skip tests that require database - they fail in CI without DB
	test.skip('should load the homepage', async ({ page }) => {
		await page.goto('/');
		const layoutWrapper = page.locator('.layout-wrapper');
		await expect(layoutWrapper).toBeVisible();
	});

	test.skip('should display the footer with build timestamp', async ({ page }) => {
		await page.goto('/');

		const footer = page.locator('footer');
		await expect(footer).toBeVisible();

		const buildInfo = page.locator('.build-info');
		await expect(buildInfo).toBeVisible();
		await expect(buildInfo).toContainText('Built on');
	});

	test.skip('should have proper page structure', async ({ page }) => {
		await page.goto('/');

		const layoutWrapper = page.locator('.layout-wrapper');
		await expect(layoutWrapper).toBeVisible();

		const mainContent = page.locator('.main-content');
		await expect(mainContent).toBeVisible();

		const footer = page.locator('footer.footer');
		await expect(footer).toBeVisible();
	});
});
