/**
 * Store global pour la législature sélectionnée
 * Persisté en localStorage pour survivre aux rechargements de page
 * Les données des législatures sont chargées depuis le serveur via +layout.server.ts
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type LegislatureValue = string | null;

const STORAGE_KEY = 'noselus-legislature';

/**
 * Récupère la législature sauvegardée depuis localStorage
 */
function getStoredValue(): string | null {
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'null') return null;
		return stored;
	}
	return null;
}

// Créer le store avec la valeur initiale depuis localStorage (ou null)
function createLegislatureStore() {
	const { subscribe, set } = writable<LegislatureValue>(getStoredValue());

	return {
		subscribe,
		set: (value: LegislatureValue) => {
			if (browser) {
				if (value === null) {
					localStorage.setItem(STORAGE_KEY, 'null');
				} else {
					localStorage.setItem(STORAGE_KEY, value);
				}
			}
			set(value);
		},
		/**
		 * Initialise le store avec la législature courante si aucune valeur n'est stockée
		 */
		initialize: (currentLegislature: string) => {
			if (browser) {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored === null) {
					// Pas de valeur stockée, utiliser la législature courante
					localStorage.setItem(STORAGE_KEY, currentLegislature);
					set(currentLegislature);
				}
			}
		}
	};
}

export const legislatureStore = createLegislatureStore();

/**
 * Obtient le label court d'une législature (ex: "17e")
 */
export function getLegislatureShortLabel(value: string | null): string {
	if (!value) return 'Toutes';
	return `${value}e`;
}
