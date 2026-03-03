export type DominantPosition = 'pour' | 'contre' | 'abstention';

export function getDominant(bilan: {
	scrutinsPour: number;
	scrutinsContre: number;
	scrutinsAbstention: number;
}): DominantPosition {
	if (
		bilan.scrutinsPour >= bilan.scrutinsContre &&
		bilan.scrutinsPour >= bilan.scrutinsAbstention
	) {
		return 'pour';
	}
	if (
		bilan.scrutinsContre >= bilan.scrutinsPour &&
		bilan.scrutinsContre >= bilan.scrutinsAbstention
	) {
		return 'contre';
	}
	return 'abstention';
}
