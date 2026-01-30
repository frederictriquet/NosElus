/**
 * Store pour les périodes sélectionnées par chambre
 * Chaque chambre a son propre concept de période:
 * - AN: Législature (12-17)
 * - Sénat: Renouvellement (2023, 2020, 2017...)
 * - PE: Terme (6-10)
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Chamber = 'an' | 'senat' | 'pe';
export type PeriodValue = string | null;

const STORAGE_KEYS = {
	an: 'noselus-an-legislature',
	senat: 'noselus-senat-renouvellement',
	pe: 'noselus-pe-terme'
} as const;

// Migration depuis l'ancien format
const OLD_STORAGE_KEY = 'noselus-legislature';

function migrateOldStorage(): void {
	if (!browser) return;
	const oldValue = localStorage.getItem(OLD_STORAGE_KEY);
	if (oldValue && !localStorage.getItem(STORAGE_KEYS.an)) {
		localStorage.setItem(STORAGE_KEYS.an, oldValue);
		localStorage.removeItem(OLD_STORAGE_KEY);
	}
}

function getStoredValue(chamber: Chamber): PeriodValue {
	if (!browser) return null;
	const stored = localStorage.getItem(STORAGE_KEYS[chamber]);
	if (stored === 'null') return null;
	return stored;
}

function setStoredValue(chamber: Chamber, value: PeriodValue): void {
	if (!browser) return;
	if (value === null) {
		localStorage.setItem(STORAGE_KEYS[chamber], 'null');
	} else {
		localStorage.setItem(STORAGE_KEYS[chamber], value);
	}
}

// Migration au chargement
if (browser) {
	migrateOldStorage();
}

interface ChamberPeriodStore {
	an: PeriodValue;
	senat: PeriodValue;
	pe: PeriodValue;
}

function createChamberPeriodStore() {
	const store = writable<ChamberPeriodStore>({
		an: getStoredValue('an'),
		senat: getStoredValue('senat'),
		pe: getStoredValue('pe')
	});

	return {
		subscribe: store.subscribe,
		set: (chamber: Chamber, value: PeriodValue) => {
			setStoredValue(chamber, value);
			store.update((state) => ({
				...state,
				[chamber]: value
			}));
		},
		initialize: (chamber: Chamber, defaultValue: string) => {
			if (browser) {
				const stored = localStorage.getItem(STORAGE_KEYS[chamber]);
				if (stored === null) {
					setStoredValue(chamber, defaultValue);
					store.update((state) => ({
						...state,
						[chamber]: defaultValue
					}));
				}
			}
		},
		get: (chamber: Chamber): PeriodValue => {
			let value: PeriodValue = null;
			store.subscribe((state) => {
				value = state[chamber];
			})();
			return value;
		}
	};
}

export const chamberPeriodStore = createChamberPeriodStore();

// Stores dérivés pour chaque chambre (pour compatibilité)
export const anPeriod = derived(chamberPeriodStore, ($store) => $store.an);
export const senatPeriod = derived(chamberPeriodStore, ($store) => $store.senat);
export const pePeriod = derived(chamberPeriodStore, ($store) => $store.pe);

/**
 * Helper pour obtenir le label court selon la chambre
 */
export function getPeriodShortLabel(chamber: Chamber, value: PeriodValue): string {
	if (!value) {
		switch (chamber) {
			case 'an':
				return 'Toutes';
			case 'senat':
				return 'Tous';
			case 'pe':
				return 'Tous';
		}
	}

	switch (chamber) {
		case 'an':
			return `${value}e`;
		case 'senat':
			return value;
		case 'pe':
			return `${value}e`;
	}
}

/**
 * Helper pour obtenir le nom du paramètre URL selon la chambre
 */
export function getUrlParamName(chamber: Chamber): string {
	switch (chamber) {
		case 'an':
			return 'legislature';
		case 'senat':
			return 'renouvellement';
		case 'pe':
			return 'terme';
	}
}
