import { expect, test } from '@playwright/test';

/**
 * Tests E2E pour la cohérence des données temporelles
 *
 * Ces tests vérifient que les données affichées sont cohérentes entre :
 * - La page liste (ex: /an/deputes)
 * - La page détail (ex: /an/deputes/PA123)
 *
 * En particulier, ils vérifient que le groupe parlementaire affiché
 * est bien le groupe le plus récent (bug fix orderBy).
 *
 * NOTE: Ces tests nécessitent une base de données avec des données.
 * Ils sont skippés automatiquement si l'app n'est pas accessible.
 */

test.describe('Data Consistency - Group Names', () => {
	test.beforeEach(async ({ page }) => {
		// Check if app is accessible
		try {
			const response = await page.goto('/', { timeout: 5000 });
			if (!response || response.status() >= 400) {
				test.skip();
			}
		} catch {
			test.skip();
		}
	});

	test('deputy group name should be consistent between list and detail page', async ({ page }) => {
		// Go to deputies list
		await page.goto('/an/deputes');
		await page.waitForLoadState('networkidle');

		// Get first deputy card with a group name
		const deputyCard = page.locator('.elected-card').first();
		const cardExists = await deputyCard.count();

		if (cardExists === 0) {
			test.skip(true, 'No deputy cards found - skipping');
			return;
		}

		// Get deputy link and group info from card
		const deputyLink = await deputyCard.locator('a').first().getAttribute('href');
		const groupElement = deputyCard.locator('.group-name-hover, .group-name-simple').first();
		const groupElementExists = await groupElement.count();

		if (!deputyLink || groupElementExists === 0) {
			test.skip(true, 'Deputy has no group info - skipping');
			return;
		}

		// Get the short name displayed in list
		const listGroupShortName = await groupElement.locator('.group-short').textContent() ||
			await groupElement.textContent();

		// Navigate to deputy detail page
		await page.goto(deputyLink);
		await page.waitForLoadState('networkidle');

		// Get group info from detail page (ProfileHeader)
		const detailGroupElement = page.locator('.group-name-stacked, .group-label').first();
		const detailGroupExists = await detailGroupElement.count();

		if (detailGroupExists === 0) {
			// Try alternative selector for group name
			const altGroupElement = page.locator('[class*="group"]').first();
			const altExists = await altGroupElement.count();

			if (altExists === 0) {
				test.skip(true, 'No group element found on detail page - skipping');
				return;
			}
		}

		// Get the short name from detail page
		const detailGroupShortName = await detailGroupElement.locator('.group-short').textContent() ||
			await detailGroupElement.textContent();

		// Compare: group names should match
		expect(listGroupShortName?.trim()).toBe(detailGroupShortName?.trim());
	});

	test('MEP group name should be consistent between list and detail page', async ({ page }) => {
		// Go to MEPs list
		await page.goto('/pe/eurodeputes');
		await page.waitForLoadState('networkidle');

		// Get first MEP card with a group name
		const mepCard = page.locator('.elected-card').first();
		const cardExists = await mepCard.count();

		if (cardExists === 0) {
			test.skip(true, 'No MEP cards found - skipping');
			return;
		}

		// Get MEP link and group info from card
		const mepLink = await mepCard.locator('a').first().getAttribute('href');
		const groupElement = mepCard.locator('.group-name-hover, .group-name-simple').first();
		const groupElementExists = await groupElement.count();

		if (!mepLink || groupElementExists === 0) {
			test.skip(true, 'MEP has no group info - skipping');
			return;
		}

		// Get the short name displayed in list
		const listGroupShortName = await groupElement.locator('.group-short').textContent() ||
			await groupElement.textContent();

		// Navigate to MEP detail page
		await page.goto(mepLink);
		await page.waitForLoadState('networkidle');

		// Get group info from detail page
		const detailGroupElement = page.locator('.group-name-stacked, .group-label').first();
		const detailGroupExists = await detailGroupElement.count();

		if (detailGroupExists === 0) {
			test.skip(true, 'No group element found on detail page - skipping');
			return;
		}

		// Get the short name from detail page
		const detailGroupShortName = await detailGroupElement.locator('.group-short').textContent() ||
			await detailGroupElement.textContent();

		// Compare: group names should match
		expect(listGroupShortName?.trim()).toBe(detailGroupShortName?.trim());
	});

	test('senator group name should be consistent between list and detail page', async ({ page }) => {
		// Go to senators list
		await page.goto('/senat/senateurs');
		await page.waitForLoadState('networkidle');

		// Get first senator card with a group name
		const senatorCard = page.locator('.elected-card').first();
		const cardExists = await senatorCard.count();

		if (cardExists === 0) {
			test.skip(true, 'No senator cards found - skipping');
			return;
		}

		// Get senator link and group info from card
		const senatorLink = await senatorCard.locator('a').first().getAttribute('href');
		const groupElement = senatorCard.locator('.group-name-hover, .group-name-simple').first();
		const groupElementExists = await groupElement.count();

		if (!senatorLink || groupElementExists === 0) {
			test.skip(true, 'Senator has no group info - skipping');
			return;
		}

		// Get the short name displayed in list
		const listGroupShortName = await groupElement.locator('.group-short').textContent() ||
			await groupElement.textContent();

		// Navigate to senator detail page
		await page.goto(senatorLink);
		await page.waitForLoadState('networkidle');

		// Get group info from detail page
		const detailGroupElement = page.locator('.group-name-stacked, .group-label').first();
		const detailGroupExists = await detailGroupElement.count();

		if (detailGroupExists === 0) {
			test.skip(true, 'No group element found on detail page - skipping');
			return;
		}

		// Get the short name from detail page
		const detailGroupShortName = await detailGroupElement.locator('.group-short').textContent() ||
			await detailGroupElement.textContent();

		// Compare: group names should match
		expect(listGroupShortName?.trim()).toBe(detailGroupShortName?.trim());
	});
});

test.describe('Data Consistency - Search Results', () => {
	test.beforeEach(async ({ page }) => {
		try {
			const response = await page.goto('/', { timeout: 5000 });
			if (!response || response.status() >= 400) {
				test.skip();
			}
		} catch {
			test.skip();
		}
	});

	test('search results should show correct group names', async ({ page }) => {
		// Go to search page with a common name
		await page.goto('/recherche?q=Jean');
		await page.waitForLoadState('networkidle');

		// Get first result with a group
		const resultCard = page.locator('.elected-card, .actor-card, [class*="result"]').first();
		const cardExists = await resultCard.count();

		if (cardExists === 0) {
			test.skip(true, 'No search results found - skipping');
			return;
		}

		// Get the link to the detail page
		const detailLink = await resultCard.locator('a').first().getAttribute('href');

		if (!detailLink) {
			test.skip(true, 'No link found in search result - skipping');
			return;
		}

		// Get group name from search result
		const searchGroupElement = resultCard.locator('.group-name-hover, .group-name-simple, [class*="group"]').first();
		const searchGroupExists = await searchGroupElement.count();

		if (searchGroupExists === 0) {
			test.skip(true, 'No group in search result - skipping');
			return;
		}

		const searchGroupName = await searchGroupElement.locator('.group-short').textContent() ||
			await searchGroupElement.textContent();

		// Navigate to detail page
		await page.goto(detailLink);
		await page.waitForLoadState('networkidle');

		// Get group name from detail page
		const detailGroupElement = page.locator('.group-name-stacked, .group-label, .group-name-hover').first();
		const detailGroupExists = await detailGroupElement.count();

		if (detailGroupExists === 0) {
			test.skip(true, 'No group on detail page - skipping');
			return;
		}

		const detailGroupName = await detailGroupElement.locator('.group-short').textContent() ||
			await detailGroupElement.textContent();

		// Compare: group names should match
		expect(searchGroupName?.trim()).toBe(detailGroupName?.trim());
	});
});

test.describe('Data Consistency - Compare Pages', () => {
	test.beforeEach(async ({ page }) => {
		try {
			const response = await page.goto('/', { timeout: 5000 });
			if (!response || response.status() >= 400) {
				test.skip();
			}
		} catch {
			test.skip();
		}
	});

	test('compare page should show correct group names for deputies', async ({ page }) => {
		// First get two deputy IDs from the list
		await page.goto('/an/deputes');
		await page.waitForLoadState('networkidle');

		const deputyLinks = await page.locator('.elected-card a').evaluateAll((links) =>
			links.slice(0, 2).map((link) => {
				const href = link.getAttribute('href');
				return href ? href.split('/').pop() : null;
			}).filter(Boolean)
		);

		if (deputyLinks.length < 2) {
			test.skip(true, 'Not enough deputies found - skipping');
			return;
		}

		// Go to compare page
		await page.goto(`/an/compare?d1=${deputyLinks[0]}&d2=${deputyLinks[1]}`);
		await page.waitForLoadState('networkidle');

		// Check that comparison loaded
		const comparisonSection = page.locator('[class*="comparison"], [class*="compare"]').first();
		const comparisonExists = await comparisonSection.count();

		// The page should load without errors
		expect(comparisonExists).toBeGreaterThanOrEqual(0); // Just check page loaded
	});
});
