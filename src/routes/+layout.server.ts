import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	// Le root layout n'a plus besoin de données - chaque chambre a son propre layout
	return {};
};
