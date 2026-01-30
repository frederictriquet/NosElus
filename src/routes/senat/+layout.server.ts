import type { LayoutServerLoad } from './$types';
import {
	getRenouvellements,
	getCurrentRenouvellement
} from '$lib/server/periods/senat-renouvellements';

export const load: LayoutServerLoad = async () => {
	const renouvellements = await getRenouvellements();
	const currentRenouvellement = await getCurrentRenouvellement();

	return {
		renouvellements,
		currentRenouvellement
	};
};
