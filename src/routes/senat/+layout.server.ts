import type { LayoutServerLoad } from './$types';
import {
	getRenouvellements,
	getCurrentRenouvellement
} from '$lib/server/periods/senat-renouvellements';

export const load: LayoutServerLoad = async () => {
	const renouvellements = getRenouvellements();
	const currentRenouvellement = getCurrentRenouvellement();

	return {
		renouvellements,
		currentRenouvellement
	};
};
