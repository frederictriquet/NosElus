/**
 * Page admin : État ETL et suggestions d'imports
 *
 * Analyse la DB et suggère les ETL à exécuter pour compléter les données.
 *
 * **Pattern SvelteKit Streaming** : Les promises ne sont PAS awaited
 * pour permettre un affichage progressif avec AsyncCard.
 *
 * @see src/lib/server/etl/checks.ts
 */

import type { PageServerLoad } from './$types';
import { loadSyncStatus, loadETLChecks } from '$lib/server/etl/checks';

export const load: PageServerLoad = async () => {
	/**
	 * Pattern SvelteKit Streaming : retourner des promises NON RÉSOLUES.
	 *
	 * ✅ Correct : `syncStatus: loadSyncStatus()` (promise non résolue)
	 * ❌ Incorrect : `syncStatus: await loadSyncStatus()` (bloque le loader)
	 *
	 * Le template côté client gère le `{#await}` natif et affiche :
	 * - Skeleton pendant le chargement
	 * - Contenu une fois la promise résolue
	 * - Message d'erreur si la promise rejette
	 *
	 * @see src/routes/stats/data-quality/+page.server.ts pour pattern similaire
	 */
	return {
		syncStatus: loadSyncStatus(),
		etlChecks: loadETLChecks()
	};
};
