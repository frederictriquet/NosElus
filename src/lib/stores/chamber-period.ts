/**
 * Store pour les périodes sélectionnées par chambre
 * Chaque chambre a son propre concept de période:
 * - AN: Législature (12-17)
 * - Sénat: Renouvellement (2023, 2020, 2017...)
 * - PE: Terme (6-10)
 *
 * Les périodes sont persistées via cookies (accessibles côté serveur et client)
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { invalidateAll } from '$app/navigation';

export type Chamber = 'an' | 'senat' | 'pe';
export type PeriodValue = string | null;

const COOKIE_NAMES = {
	an: 'noselus-period-an',
	senat: 'noselus-period-senat',
	pe: 'noselus-period-pe'
} as const;

// Durée du cookie : 1 an
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function getCookie(name: string): string | null {
	if (!browser) return null;
	const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
	return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string | null): void {
	if (!browser) return;
	if (value === null) {
		// Supprimer le cookie
		document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
	} else {
		document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
	}
}

interface ChamberPeriodStore {
	an: PeriodValue;
	senat: PeriodValue;
	pe: PeriodValue;
}

function createChamberPeriodStore() {
	// Initialisation depuis les cookies
	const initial: ChamberPeriodStore = {
		an: getCookie(COOKIE_NAMES.an),
		senat: getCookie(COOKIE_NAMES.senat),
		pe: getCookie(COOKIE_NAMES.pe)
	};

	const store = writable<ChamberPeriodStore>(initial);

	return {
		subscribe: store.subscribe,

		/**
		 * Définit la période pour une chambre
		 * Met à jour le cookie et invalide les données pour recharger
		 */
		set: (chamber: Chamber, value: PeriodValue, shouldInvalidate = true) => {
			setCookie(COOKIE_NAMES[chamber], value);
			store.update((state) => ({
				...state,
				[chamber]: value
			}));
			// Invalider les données pour que les pages rechargent avec la nouvelle période
			if (shouldInvalidate && browser) {
				invalidateAll();
			}
		},

		/**
		 * Initialise la période depuis les données serveur (si pas de cookie)
		 */
		initialize: (chamber: Chamber, defaultValue: string) => {
			const currentValue = get(store)[chamber];
			if (currentValue === null) {
				setCookie(COOKIE_NAMES[chamber], defaultValue);
				store.update((state) => ({
					...state,
					[chamber]: defaultValue
				}));
			}
		},

		/**
		 * Initialise le store côté client depuis les valeurs serveur
		 * Appelé une fois au démarrage du client
		 */
		hydrateFromServer: (serverPeriods: { an: PeriodValue; senat: PeriodValue; pe: PeriodValue }) => {
			store.set(serverPeriods);
		},

		/**
		 * Récupère la valeur actuelle pour une chambre
		 */
		get: (chamber: Chamber): PeriodValue => {
			return get(store)[chamber];
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
	if (!value || value === 'all') {
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
 * @deprecated Les périodes ne sont plus passées dans l'URL
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
