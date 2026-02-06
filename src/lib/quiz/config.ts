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
