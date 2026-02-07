/**
 * Configuration des quiz politiques par chambre.
 *
 * Centralise tous les paramètres spécifiques à chaque chambre
 * pour éviter la duplication de code entre AN et PE.
 */

export interface QuizChamberConfig {
	chamber: 'an' | 'pe';
	legislature: string;
	basePath: string;
	resultsPath: string;
	lawBasePath: string;
	chamberLabel: string;
	periodLabel: string;
	storageKey: string;
	sessionKey: string;
}

export const AN_QUIZ_CONFIG: QuizChamberConfig = {
	chamber: 'an',
	legislature: '17',
	basePath: '/an/quiz',
	resultsPath: '/an/quiz/resultats',
	lawBasePath: '/an/laws',
	chamberLabel: "l'Assemblée nationale",
	periodLabel: 'législature 17',
	storageKey: 'noselus-quiz-votes',
	sessionKey: 'noselus-quiz-session'
};

/**
 * Convertit un identifiant de législature en format organs.
 *
 * Les groupes PE (table `organs`) ont `legislature = '10'` alors que
 * les scrutins/lois PE utilisent `legislature = 'PE-10'`. Cette fonction
 * normalise l'identifiant pour les requêtes sur la table organs.
 *
 * @param legislature - Identifiant de législature (ex: '17', 'PE-10')
 * @returns L'identifiant normalisé pour organs (ex: '17', '10')
 *
 * @example
 * ```typescript
 * getOrgansLegislature('17');     // → '17' (AN, inchangé)
 * getOrgansLegislature('PE-10');  // → '10' (PE, préfixe retiré)
 * ```
 */
export function getOrgansLegislature(legislature: string): string {
	return legislature.startsWith('PE-') ? legislature.slice(3) : legislature;
}

export const PE_QUIZ_CONFIG: QuizChamberConfig = {
	chamber: 'pe',
	legislature: 'PE-10',
	basePath: '/pe/quiz',
	resultsPath: '/pe/quiz/resultats',
	lawBasePath: '/pe/scrutins',
	chamberLabel: 'le Parlement européen',
	periodLabel: 'terme 10',
	storageKey: 'noselus-quiz-pe-votes',
	sessionKey: 'noselus-quiz-pe-session'
};
