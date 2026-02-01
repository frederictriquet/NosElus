/**
 * Classification sémantique des scrutins parlementaires.
 *
 * Ce module fournit la logique de classification des scrutins selon leur nature :
 * vote final, article, amendement, procédure, budget, constitutionnel.
 *
 * Les règles sont basées sur l'analyse du titre du scrutin via des expressions régulières.
 * L'ordre de priorité est important : les règles les plus spécifiques sont testées en premier.
 */

/**
 * Catégorie sémantique d'un scrutin.
 *
 * Ces valeurs ne sont PAS hardcodées dans l'application : elles sont toujours
 * récupérées dynamiquement depuis la base de données via SELECT DISTINCT.
 */
export type ScrutinCategory =
	| 'vote-final'
	| 'article'
	| 'amendement'
	| 'procédure'
	| 'budget'
	| 'constitutionnel'
	| 'autre';

/**
 * Règle de classification associant un pattern regex à une catégorie.
 */
interface ClassificationRule {
	/** Expression régulière testée sur le titre du scrutin */
	pattern: RegExp;
	/** Catégorie assignée si le pattern matche */
	category: ScrutinCategory;
	/** Description de la règle (pour debug/documentation) */
	description: string;
}

/**
 * Règles de classification par ordre de priorité (du plus spécifique au plus général).
 *
 * Ordre :
 * 1. Procédure (motions, questions de confiance) - très spécifique
 * 2. Constitutionnel (projets de loi constitutionnels/organiques)
 * 3. Budget (lois de finances)
 * 4. Vote final (ensemble du texte)
 * 5. Amendement (très fréquent)
 * 6. Article
 *
 * Note : Si aucune règle ne matche, la catégorie 'autre' est retournée.
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
	{
		pattern:
			/motion de (rejet|renvoi|censure)|question de confiance|exception d'irrecevabilité|déclaration de politique générale|article 49/i,
		category: 'procédure',
		description: 'Motions, questions de confiance, procédures parlementaires'
	},
	{
		pattern: /projet de loi (constitutionnel|organique)|loi organique|constitution/i,
		category: 'constitutionnel',
		description: 'Textes constitutionnels ou organiques'
	},
	{
		pattern: /loi de finances|projet de loi de règlement|crédits.*mission|budget/i,
		category: 'budget',
		description: 'Lois de finances et textes budgétaires'
	},
	{
		pattern: /l'ensemble (du|de la|des) (projet|proposition)/i,
		category: 'vote-final',
		description: "Vote sur l'ensemble d'un texte"
	},
	{
		pattern: /l'amendement n°|les amendements? (n°|identiques|de)/i,
		category: 'amendement',
		description: 'Votes sur amendements'
	},
	{
		pattern: /l'article (premier|\d+|unique)|les articles/i,
		category: 'article',
		description: 'Votes sur articles spécifiques'
	}
];

/**
 * Classifie un scrutin selon son titre.
 *
 * @param title - Le titre du scrutin (champ scrutins.title)
 * @returns La catégorie déterminée
 *
 * @example
 * ```typescript
 * classifyScrutin("l'ensemble du projet de loi...") // "vote-final"
 * classifyScrutin("l'amendement n° 123...") // "amendement"
 * classifyScrutin("la motion de rejet...") // "procédure"
 * ```
 */
export function classifyScrutin(title: string): ScrutinCategory {
	// Défense contre les valeurs invalides
	if (!title || typeof title !== 'string') {
		return 'autre';
	}

	// Tester chaque règle dans l'ordre de priorité
	for (const rule of CLASSIFICATION_RULES) {
		if (rule.pattern.test(title)) {
			return rule.category;
		}
	}

	// Aucune règle ne matche : fallback
	return 'autre';
}

/**
 * Labels en français pour l'affichage UI.
 *
 * Ces labels sont utilisés dans les interfaces utilisateur pour afficher
 * les catégories de façon lisible.
 */
export const CATEGORY_LABELS: Record<ScrutinCategory, string> = {
	'vote-final': 'Vote final',
	article: 'Article',
	amendement: 'Amendement',
	procédure: 'Procédure',
	budget: 'Budget',
	constitutionnel: 'Constitutionnel',
	autre: 'Autre'
};

/**
 * Retourne le label UI pour une catégorie donnée.
 *
 * @param category - La catégorie du scrutin
 * @returns Le label traduit en français
 *
 * @example
 * ```typescript
 * getCategoryLabel('vote-final') // "Vote final"
 * getCategoryLabel('amendement') // "Amendement"
 * ```
 */
export function getCategoryLabel(category: ScrutinCategory): string {
	return CATEGORY_LABELS[category] ?? category;
}
