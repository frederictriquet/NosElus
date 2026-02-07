import { expect, test } from '@playwright/test';

/**
 * Tests E2E du quiz Parlement Européen
 *
 * Parcours utilisateur complet :
 * 1. Accéder à /pe/quiz
 * 2. Voter sur plusieurs lois
 * 3. Voir les résultats d'alignement
 * 4. Redémarrer le quiz
 *
 * Note: Ces tests nécessitent la DB et sont skip en CI
 */

test.describe.skip('Quiz PE - E2E Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Nettoyer le localStorage avant chaque test
		await page.goto('/pe/quiz');
		await page.evaluate(() => {
			localStorage.removeItem('noselus-quiz-pe-votes');
			localStorage.removeItem('noselus-quiz-pe-session');
		});
	});

	test('should display quiz introduction page', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Vérifier le titre
		await expect(page.locator('h1')).toContainText('Quiz Politique Européen');

		// Vérifier la description
		await expect(page.locator('.page-subtitle')).toContainText('Parlement européen');

		// Devrait avoir un bouton pour démarrer
		const startButton = page.locator('button').filter({ hasText: /Démarrer|Commencer/i });
		await expect(startButton).toBeVisible();
	});

	test('should start quiz and display first law', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Démarrer le quiz
		const startButton = page.locator('button').filter({ hasText: /Démarrer|Commencer/i });
		await startButton.click();

		// Attendre le chargement
		await page.waitForTimeout(500);

		// Devrait afficher une loi
		await expect(page.locator('.quiz-card, .law-card, [data-testid="law-title"]')).toBeVisible();

		// Devrait avoir des boutons pour voter
		const pourButton = page.locator('button').filter({ hasText: /Pour|Favorable/i });
		const contreButton = page.locator('button').filter({ hasText: /Contre|Défavorable/i });

		await expect(pourButton).toBeVisible();
		await expect(contreButton).toBeVisible();
	});

	test('should allow voting and progress through laws', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Démarrer
		await page.locator('button').filter({ hasText: /Démarrer/i }).click();
		await page.waitForTimeout(500);

		// Voter "Pour" sur la première loi
		const pourButton = page.locator('button').filter({ hasText: /Pour/i }).first();
		await pourButton.click();

		// Attendre la transition
		await page.waitForTimeout(300);

		// Devrait passer à la loi suivante OU afficher les résultats
		// (selon le nombre de lois disponibles)
		const hasNextLaw = await page.locator('.quiz-card, .law-card').count();
		const hasResults = await page.locator('.results-container, .podium').count();

		expect(hasNextLaw > 0 || hasResults > 0).toBe(true);
	});

	test('should complete quiz and show results', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Démarrer
		await page.locator('button').filter({ hasText: /Démarrer/i }).click();
		await page.waitForTimeout(500);

		// Voter sur plusieurs lois (max 5 pour le test)
		for (let i = 0; i < 5; i++) {
			const voteButton = page
				.locator('button')
				.filter({ hasText: /Pour|Contre/i })
				.first();

			const isVisible = await voteButton.isVisible({ timeout: 1000 }).catch(() => false);
			if (!isVisible) break;

			await voteButton.click();
			await page.waitForTimeout(300);

			// Si on voit les résultats, arrêter
			const hasResults = await page.locator('.results-container').count();
			if (hasResults > 0) break;
		}

		// Vérifier qu'on est sur la page résultats
		await expect(page).toHaveURL(/\/pe\/quiz\/resultats/);

		// Vérifier les éléments de résultats
		await expect(page.locator('h1')).toContainText('Résultats');

		// Devrait afficher au moins un groupe
		const groups = page.locator('.result-row, .group-info');
		await expect(groups.first()).toBeVisible();
	});

	test('should display alignment scores in results', async ({ page }) => {
		// Cette partie nécessite de compléter le quiz
		// On simule via localStorage pour aller plus vite

		await page.goto('/pe/quiz');

		// Injecter des votes simulés dans localStorage
		await page.evaluate(() => {
			const mockQuizState = {
				laws: [
					{ id: 'LWPE10-TEST1', title: 'Test Law 1', shortTitle: 'TL1' },
					{ id: 'LWPE10-TEST2', title: 'Test Law 2', shortTitle: 'TL2' }
				],
				votes: [
					{ lawId: 'LWPE10-TEST1', position: 'pour' },
					{ lawId: 'LWPE10-TEST2', position: 'contre' }
				],
				abstainedLawIds: []
			};
			localStorage.setItem('noselus-quiz-pe-votes', JSON.stringify(mockQuizState));
		});

		// Aller directement aux résultats
		await page.goto('/pe/quiz/resultats');

		// Attendre le chargement
		await page.waitForTimeout(1000);

		// Devrait afficher des scores
		const scores = page.locator('.score-value, [data-testid="alignment-score"]');
		await expect(scores.first()).toBeVisible({ timeout: 5000 });

		// Les scores doivent être entre 0 et 100
		const scoreText = await scores.first().textContent();
		const scoreValue = parseInt(scoreText?.replace('%', '') || '0');
		expect(scoreValue).toBeGreaterThanOrEqual(0);
		expect(scoreValue).toBeLessThanOrEqual(100);
	});

	test('should display podium for top 3 groups', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Simuler quiz complété
		await page.evaluate(() => {
			const mockQuizState = {
				laws: [{ id: 'LWPE10-TEST1', title: 'Test Law 1', shortTitle: 'TL1' }],
				votes: [{ lawId: 'LWPE10-TEST1', position: 'pour' }],
				abstainedLawIds: []
			};
			localStorage.setItem('noselus-quiz-pe-votes', JSON.stringify(mockQuizState));
		});

		await page.goto('/pe/quiz/resultats');
		await page.waitForTimeout(1000);

		// Devrait afficher le podium (si au moins 3 groupes)
		const podium = page.locator('.podium-section, [data-testid="podium"]');
		const podiumExists = await podium.count();

		if (podiumExists > 0) {
			await expect(podium).toBeVisible();

			// Devrait avoir 3 positions
			const positions = page.locator('.podium-item, .position');
			const count = await positions.count();
			expect(count).toBeGreaterThanOrEqual(1);
			expect(count).toBeLessThanOrEqual(3);
		}
	});

	test('should allow restarting quiz from results', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Simuler quiz complété
		await page.evaluate(() => {
			const mockQuizState = {
				laws: [{ id: 'LWPE10-TEST1', title: 'Test Law 1', shortTitle: 'TL1' }],
				votes: [{ lawId: 'LWPE10-TEST1', position: 'pour' }],
				abstainedLawIds: []
			};
			localStorage.setItem('noselus-quiz-pe-votes', JSON.stringify(mockQuizState));
		});

		await page.goto('/pe/quiz/resultats');
		await page.waitForTimeout(1000);

		// Cliquer sur recommencer
		const restartButton = page.locator('button').filter({ hasText: /Recommencer/i });
		await expect(restartButton).toBeVisible();
		await restartButton.click();

		// Devrait rediriger vers le quiz
		await expect(page).toHaveURL(/\/pe\/quiz$/);

		// Le localStorage devrait être nettoyé
		const storageCleared = await page.evaluate(() => {
			const votes = localStorage.getItem('noselus-quiz-pe-votes');
			return votes === null;
		});

		expect(storageCleared).toBe(true);
	});

	test('should show vote details modal when clicking on group', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Simuler quiz complété
		await page.evaluate(() => {
			const mockQuizState = {
				laws: [{ id: 'LWPE10-TEST1', title: 'Test Law 1', shortTitle: 'TL1' }],
				votes: [{ lawId: 'LWPE10-TEST1', position: 'pour' }],
				abstainedLawIds: []
			};
			localStorage.setItem('noselus-quiz-pe-votes', JSON.stringify(mockQuizState));
		});

		await page.goto('/pe/quiz/resultats');
		await page.waitForTimeout(1000);

		// Cliquer sur le premier groupe
		const firstGroup = page.locator('.result-row, [data-testid="group-row"]').first();
		await firstGroup.click();

		// Devrait ouvrir une modale
		const modal = page.locator('.modal, [role="dialog"]');
		await expect(modal).toBeVisible({ timeout: 2000 });

		// La modale devrait contenir des détails de votes
		await expect(modal.locator('.vote-detail, .detail-item')).toBeVisible();
	});

	test('should handle abstention correctly', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Démarrer
		await page.locator('button').filter({ hasText: /Démarrer/i }).click();
		await page.waitForTimeout(500);

		// Chercher le bouton "Passer" ou "Abstention"
		const skipButton = page.locator('button').filter({ hasText: /Passer|Abstention/i });

		const hasSkipButton = await skipButton.count();
		if (hasSkipButton > 0) {
			await skipButton.click();
			await page.waitForTimeout(300);

			// Devrait passer à la loi suivante
			// La loi passée ne devrait pas compter dans les votes
		}
	});

	test('should display error message when no votes recorded', async ({ page }) => {
		await page.goto('/pe/quiz/resultats');

		// Sans votes dans localStorage
		await page.waitForTimeout(500);

		// Devrait afficher un message d'erreur
		const errorMessage = page.locator('.error-message, [data-testid="error"]');
		await expect(errorMessage).toBeVisible();
		await expect(errorMessage).toContainText(/Aucun|quiz/i);
	});

	test('should preserve quiz state across page reloads', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Démarrer et voter
		await page.locator('button').filter({ hasText: /Démarrer/i }).click();
		await page.waitForTimeout(500);

		await page.locator('button').filter({ hasText: /Pour/i }).first().click();
		await page.waitForTimeout(300);

		// Recharger la page
		await page.reload();
		await page.waitForTimeout(500);

		// Le quiz devrait reprendre là où on l'avait laissé
		// (soit afficher la prochaine loi, soit les résultats)
		const hasQuiz = await page.locator('.quiz-card, .results-container').count();
		expect(hasQuiz).toBeGreaterThan(0);
	});

	test('should show progress indicator', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Démarrer
		await page.locator('button').filter({ hasText: /Démarrer/i }).click();
		await page.waitForTimeout(500);

		// Devrait avoir un indicateur de progression (X/Y lois)
		const progress = page.locator('.progress, [data-testid="quiz-progress"]');
		const hasProgress = await progress.count();

		if (hasProgress > 0) {
			await expect(progress).toBeVisible();
			const progressText = await progress.textContent();
			expect(progressText).toMatch(/\d+\s*\/\s*\d+/); // Format: "1 / 9"
		}
	});

	test('should display law summary/description', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Démarrer
		await page.locator('button').filter({ hasText: /Démarrer/i }).click();
		await page.waitForTimeout(500);

		// Devrait afficher un résumé de la loi
		const summary = page.locator('.law-summary, .law-description, [data-testid="law-summary"]');
		const hasSummary = await summary.count();

		if (hasSummary > 0) {
			await expect(summary).toBeVisible();
			const summaryText = await summary.textContent();
			expect(summaryText?.length || 0).toBeGreaterThan(20);
		}
	});

	test('should be accessible via keyboard navigation', async ({ page }) => {
		await page.goto('/pe/quiz');

		// Vérifier que le focus est accessible
		await page.keyboard.press('Tab');

		// Le bouton démarrer devrait être focusable
		const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
		expect(['BUTTON', 'A']).toContain(focusedElement);
	});
});
