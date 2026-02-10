# Standard : Définitions de Données Partagées

## Catégorie

Data Quality / Architecture / Standards

## Date d'adoption

2026-02-09

## Règle

**Toute définition de "donnée complète/valide" utilisée par multiple composants DOIT être centralisée dans une constante ou helper partagé.**

## Justification

### Problème observé (2026-02-09)

Deux composants utilisaient des définitions différentes de "texte complet" :

- ETL LLM : `isNotNull(description)` ❌
- Dashboard : `length(description) > 100` ✅

**Résultat** : 1190 résumés IA générés pour des descriptions de 25 chars ("Proposition de résolution").

### Root Cause

Définitions implicites dispersées dans le code → incohérences silencieuses.

### Bénéfices de la centralisation

✅ **Une seule source de vérité** : Impossible d'avoir des définitions divergentes
✅ **Maintenabilité** : Changer la définition une seule fois
✅ **Documentation** : La constante documente la règle métier
✅ **Type safety** : TypeScript peut garantir l'usage de la bonne constante
✅ **Testabilité** : Une seule logique à tester

## Définitions Officielles du Projet

### Textes de Lois

````typescript
// src/lib/server/db/constants.ts

/**
 * Seuil minimal (en caractères) pour considérer une description comme "texte complet".
 *
 * Les descriptions courtes (≤100 chars) sont des labels génériques comme
 * "Proposition de résolution" (25 chars) qui ne contiennent pas de texte analysable.
 *
 * @constant
 * @example
 * ```typescript
 * if (law.description && law.description.length > MIN_DESCRIPTION_LENGTH) {
 *   // Texte suffisamment long pour analyse LLM
 * }
 * ```
 */
export const MIN_DESCRIPTION_LENGTH = 100;

/**
 * Filtre Drizzle ORM pour "texte complet" utilisable dans les requêtes SQL.
 *
 * @example
 * ```typescript
 * const laws = await db
 *   .select()
 *   .from(laws)
 *   .where(hasFullTextFilter);
 * ```
 */
export const hasFullTextFilter = gt(sql`length(${laws.description})`, MIN_DESCRIPTION_LENGTH);
````

### Mandats Actifs

```typescript
/**
 * Critère pour considérer un mandat comme "actif" à une date donnée.
 *
 * Un mandat est actif si :
 * - Sa date de début ≤ date de référence
 * - Sa date de fin est NULL OU > date de référence
 */
export function isMandateActive(mandate: Mandate, referenceDate: Date): boolean {
	return (
		mandate.startDate <= referenceDate &&
		(mandate.endDate === null || mandate.endDate > referenceDate)
	);
}

// SQL equivalent
export function activeMandateFilter(referenceDate: Date) {
	return and(
		lte(mandates.startDate, referenceDate),
		or(isNull(mandates.endDate), gt(mandates.endDate, referenceDate))
	);
}
```

### Votes Significatifs

```typescript
/**
 * Seuil minimal de votants pour considérer un scrutin comme "significatif".
 *
 * Les scrutins avec < 50 votants sont souvent des votes procéduraux ou techniques
 * qui ne reflètent pas de véritables positions politiques.
 */
export const MIN_SIGNIFICANT_VOTES = 50;
```

## Exemples

### ✅ Correct : Utilisation de Constantes

```typescript
// ETL LLM
const unanalyzedLaws = await db.select().from(laws).where(hasFullTextFilter);

// Dashboard
const stats = await db.execute(sql`
  SELECT 
    COUNT(*) FILTER (WHERE length(description) > ${MIN_DESCRIPTION_LENGTH}) as with_full_text
  FROM laws
`);

// Quiz
function getLawsForQuiz(laws: Law[]): Law[] {
	return laws.filter((law) => law.description && law.description.length > MIN_DESCRIPTION_LENGTH);
}
```

**✅ Résultat** : Les 3 composants utilisent la même définition.

### ❌ Incorrect : Définitions Dupliquées

```typescript
// ETL LLM
const unanalyzedLaws = await db.select().from(laws).where(isNotNull(laws.description)); // ❌ Définition différente

// Dashboard
const stats = await db.execute(sql`
  SELECT 
    COUNT(*) FILTER (WHERE length(description) > 100) as with_full_text
  FROM laws
`);

// Quiz
function getLawsForQuiz(laws: Law[]): Law[] {
	return laws.filter((law) => law.description !== null); // ❌ Encore différent
}
```

**❌ Résultat** : Incohérences → données corrompues.

## Exceptions

### Quand NE PAS centraliser ?

1. **Critère local** : Utilisé dans un seul composant, pas de risque d'incohérence
2. **Validation temporaire** : Critère évoluant rapidement en phase d'expérimentation
3. **Performance critique** : Constante inline dans une hot path (rare, mesurer d'abord)

### Exemple d'exception valide

```typescript
// Composant unique : filtre UI local
function filterBySearchTerm(items: Item[], search: string): Item[] {
	const minLength = 3; // OK : utilisé uniquement ici
	if (search.length < minLength) return items;
	return items.filter((item) => item.name.includes(search));
}
```

## Checklist d'Implémentation

Quand on ajoute/modifie une logique de filtrage :

- [ ] La définition est-elle utilisée ailleurs dans le projet ? (Grep dans la codebase)
- [ ] Y a-t-il un risque d'incohérence future ? (Dashboard, ETL, Quiz, Stats...)
- [ ] Une constante/helper existe-t-il déjà ? (Vérifier `constants.ts`, `helpers.ts`)
- [ ] Si non, créer constante + JSDoc explicite
- [ ] Remplacer toutes les occurrences existantes
- [ ] Ajouter tests validant la constante
- [ ] Documenter dans ADR si décision architecturale

## Vérification

### Détection manuelle

```bash
# Chercher les valeurs magiques dupliquées
grep -r "> 100" src/
grep -r "length.*description.*100" src/

# Si plusieurs occurrences → candidat à centralisation
```

### Lint Rule (futur)

```json
// eslint custom rule
{
	"no-magic-numbers": [
		"error",
		{
			"ignore": [0, 1, -1],
			"enforceConst": true
		}
	]
}
```

## Migration d'un Projet Existant

### Étape 1 : Identifier les Définitions Critiques

Chercher les concepts métier répétés :

- "Texte complet"
- "Actif"
- "Valide"
- "Significatif"
- "Expiré"

### Étape 2 : Créer le Fichier de Constantes

```typescript
// src/lib/server/db/constants.ts
/**
 * Constantes définissant les critères métier pour la qualité des données.
 *
 * Toute modification ici impacte potentiellement :
 * - ETL (import de données)
 * - Dashboard (statistiques)
 * - Quiz (sélection de lois)
 * - API (filtres)
 */

export const MIN_DESCRIPTION_LENGTH = 100;
export const MIN_SIGNIFICANT_VOTES = 50;
// ... autres constantes
```

### Étape 3 : Remplacer Progressivement

```bash
# Commencer par un composant critique (ETL ou Dashboard)
# Puis propager aux autres composants
# Valider avec tests d'intégration
```

### Étape 4 : Ajouter Tests

```typescript
// constants.test.ts
describe('Data Quality Constants', () => {
	it('MIN_DESCRIPTION_LENGTH should filter short labels', () => {
		const shortLabel = 'Proposition de résolution'; // 25 chars
		expect(shortLabel.length).toBeLessThanOrEqual(MIN_DESCRIPTION_LENGTH);
	});

	it('MIN_DESCRIPTION_LENGTH should accept substantive text', () => {
		const substantiveText = 'A'.repeat(101);
		expect(substantiveText.length).toBeGreaterThan(MIN_DESCRIPTION_LENGTH);
	});
});
```

## Patterns Complémentaires

### Helpers avec Constantes

```typescript
// src/lib/server/db/helpers.ts
import { MIN_DESCRIPTION_LENGTH } from './constants';

/**
 * Vérifie si une loi a un texte complet analysable.
 */
export function hasFullText(law: Law): boolean {
	return law.description !== null && law.description.length > MIN_DESCRIPTION_LENGTH;
}

// Usage
const analyzableLaws = allLaws.filter(hasFullText);
```

### Type Guards

```typescript
/**
 * Type guard pour lois avec texte complet.
 */
export function isLawWithFullText(law: Law): law is Law & { description: string } {
  return law.description !== null &&
         law.description.length > MIN_DESCRIPTION_LENGTH;
}

// Usage avec type narrowing
const laws: Law[] = [...];
const withText = laws.filter(isLawWithFullText);
// Type de withText : (Law & { description: string })[]
```

## Métriques de Succès

| Indicateur             | Avant                   | Après                  |
| ---------------------- | ----------------------- | ---------------------- |
| Définitions dupliquées | 3+ occurrences          | 1 constante            |
| Risque d'incohérence   | Élevé                   | Faible                 |
| Maintenabilité         | Modification N fichiers | Modification 1 fichier |
| Documentation          | Implicite               | Explicite (JSDoc)      |

## Documentation Automatique

Les constantes servent aussi de documentation vivante :

```typescript
/**
 * @constant MIN_DESCRIPTION_LENGTH
 * @see {@link hasFullText} - Helper utilisant cette constante
 * @see {@link lessons-learned-2026-02-09-text-complete-definition} - Contexte historique
 */
```

## Voir Aussi

- `pattern-dashboard-as-data-quality-validator.md` - Détection d'incohérences
- `database-queries-factorization.md` - Factorisation requêtes
- `lessons-learned-2026-02-09-text-complete-definition.md` - Cas réel

## Historique

| Date       | Modification                           |
| ---------- | -------------------------------------- |
| 2026-02-09 | Création suite à incident PE summaries |

## Références

- Incident : Commit `3d6e997`
- Dashboard : `src/routes/stats/data-quality/+page.server.ts`
- ETL LLM : `src/lib/server/etl/sources/llm/law-analyzer.ts`
