import type { PageServerLoad } from './$types';
import { loadQuizData } from '$lib/server/quiz/load-quiz-data';

export const load: PageServerLoad = async () => {
	return loadQuizData('17');
};
