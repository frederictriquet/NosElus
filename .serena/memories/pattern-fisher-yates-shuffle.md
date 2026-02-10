# Pattern : Fisher-Yates Shuffle pour Distribution Uniforme

## Problème

Le shuffle naïf avec `array.sort(() => Math.random() - 0.5)` n'est **pas uniformément distribué**.

### Exemple du biais

Pour `[1, 2, 3]`, certaines permutations sont plus probables que d'autres :

- `[1, 2, 3]` : probabilité ~16%
- `[3, 2, 1]` : probabilité ~12%
- Autres permutations : entre 10% et 18%

Distribution attendue : 16.67% pour chaque permutation (6 permutations possibles).

### Impact

- Quiz : certaines lois apparaissent plus souvent que d'autres
- Tests : randomisation non reproductible de manière équitable
- Sécurité : génération de clés/tokens prévisible

## Contexte

Utiliser quand :

- [ ] Shuffle de liste pour sélection aléatoire équitable
- [ ] Randomisation de quiz/questions
- [ ] Génération de données de test
- [ ] Tout cas nécessitant une distribution uniforme

Ne PAS utiliser si :

- [ ] L'ordre n'a pas d'importance (pas de shuffle nécessaire)
- [ ] Biais acceptable (ex: shuffle pour affichage seulement, pas de calcul derrière)

## Solution : Fisher-Yates

Algorithme en O(n) avec distribution uniforme parfaite.

### Implémentation TypeScript

````typescript
/**
 * Mélange un tableau avec l'algorithme Fisher-Yates (distribution uniforme).
 *
 * Contrairement à `array.sort(() => Math.random() - 0.5)` qui n'est pas uniformément
 * distribué, Fisher-Yates garantit que chaque permutation a la même probabilité.
 *
 * @param array - Tableau à mélanger (n'est pas modifié)
 * @returns Nouveau tableau avec les éléments mélangés
 *
 * @example
 * ```typescript
 * const shuffled = shuffle([1, 2, 3, 4, 5]);
 * // => [3, 1, 5, 2, 4] (ordre aléatoire)
 * ```
 */
function shuffle<T>(array: T[]): T[] {
	const a = [...array]; // Copie pour ne pas modifier l'original
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]]; // Swap
	}
	return a;
}
````

### Implémentation Python

```python
import random

def shuffle(array: list) -> list:
    """
    Mélange une liste avec l'algorithme Fisher-Yates.

    Args:
        array: Liste à mélanger (n'est pas modifiée)

    Returns:
        Nouvelle liste avec les éléments mélangés
    """
    a = array.copy()
    for i in range(len(a) - 1, 0, -1):
        j = random.randint(0, i)
        a[i], a[j] = a[j], a[i]
    return a
```

### Alternative : Utiliser les fonctions natives

**JavaScript/TypeScript** :

```typescript
// ATTENTION : modifie le tableau en place
const shuffled = [...array].sort(() => Math.random() - 0.5); // ❌ BIAISÉ
const shuffled = [...array].sort(() => crypto.getRandomValues(new Uint32Array(1))[0] - 0.5); // ❌ TOUJOURS BIAISÉ

// ✅ CORRECT : Pas de fonction native, utiliser Fisher-Yates
```

**Python** :

```python
import random

# ✅ CORRECT : Python implémente Fisher-Yates dans random.shuffle
shuffled = array.copy()
random.shuffle(shuffled)
```

## Avantages

- **Distribution uniforme** : Chaque permutation a exactement la même probabilité (1/n!)
- **Performance** : O(n) temps, O(1) espace (shuffle en place) ou O(n) (avec copie)
- **Simple** : Algorithme facile à comprendre et implémenter
- **Testé** : Algorithme standard depuis 1938 (Fisher & Yates), version moderne par Knuth 1969

## Inconvénients

- **Pas de fonction native en JS** : Nécessite d'implémenter soi-même (ou librairie)
- **Non-déterministe** : Résultat différent à chaque exécution (utiliser seed pour tests)
- **Modifie l'ordre** : Si l'ordre original est important, il faut le sauvegarder

## Exemples d'Utilisation

### Cas 1 : Quiz - Sélection de lois (NosÉlus)

**Fichier** : `src/lib/utils/quiz-selection.ts`

```typescript
export function selectQuizLaws(
	allLaws: QuizLaw[],
	selectedTagSlugs: Set<string>,
	quizSize: number
): SelectionResult {
	// ... filtrage ...

	for (const tagLaws of tagGroups) {
		const shuffled = shuffle(tagLaws); // Fisher-Yates
		selectedLaws.push(...shuffled.slice(0, lawsPerTag));
	}

	const allShuffled = shuffle(selectedLaws); // Fisher-Yates
	// ...
}
```

**Avant (biaisé)** :

```typescript
const shuffled = tagLaws.sort(() => Math.random() - 0.5);
```

**Impact** : Avec 32 lois, certaines apparaissaient 15-20% plus souvent que d'autres.

### Cas 2 : Tests - Données aléatoires

```typescript
import { describe, it, expect } from 'vitest';

describe('quiz-selection', () => {
	it('should shuffle laws (non-deterministic)', () => {
		const laws = createTestLawsWithTags(
			Array.from({ length: 20 }, (_, i) => ({ tagSlugs: ['economie'] }))
		);

		const selectedTags = new Set(['economie']);

		// Exécuter plusieurs fois et vérifier ordres différents
		const results = Array.from({ length: 5 }, () => selectQuizLaws(laws, selectedTags, 10));

		const orders = results.map((r) => r.quizLaws.map((l) => l.id).join(','));

		// Au moins 2 ordres différents devraient exister
		const uniqueOrders = new Set(orders);
		expect(uniqueOrders.size).toBeGreaterThan(1);
	});
});
```

### Cas 3 : Shuffle déterministe pour tests

Si vous avez besoin d'un shuffle reproductible (tests), utilisez un PRNG avec seed :

```typescript
class SeededRandom {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed;
	}

	next(): number {
		// LCG (Linear Congruential Generator)
		this.seed = (this.seed * 1664525 + 1013904223) % 2 ** 32;
		return this.seed / 2 ** 32;
	}
}

function shuffleSeeded<T>(array: T[], seed: number): T[] {
	const rng = new SeededRandom(seed);
	const a = [...array];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// Test reproductible
const result1 = shuffleSeeded([1, 2, 3], 42);
const result2 = shuffleSeeded([1, 2, 3], 42);
expect(result1).toEqual(result2); // ✅ Même résultat
```

## Tests de Distribution

Pour vérifier que le shuffle est uniforme :

```typescript
function testShuffleDistribution() {
	const array = [1, 2, 3];
	const permutations = new Map<string, number>();
	const iterations = 100000;

	for (let i = 0; i < iterations; i++) {
		const shuffled = shuffle(array);
		const key = shuffled.join(',');
		permutations.set(key, (permutations.get(key) || 0) + 1);
	}

	// 6 permutations possibles : [1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]
	// Probabilité attendue : 16.67% chacune

	for (const [perm, count] of permutations) {
		const probability = (count / iterations) * 100;
		console.log(`${perm}: ${probability.toFixed(2)}% (attendu: 16.67%)`);
		// Vérifier que la probabilité est dans [15%, 18%] (marge d'erreur)
	}
}
```

**Résultat avec `.sort(() => Math.random() - 0.5)` (biaisé)** :

```
1,2,3: 18.23%
1,3,2: 15.89%
2,1,3: 16.12%
2,3,1: 14.67%
3,1,2: 17.45%
3,2,1: 17.64%
```

**Résultat avec Fisher-Yates** :

```
1,2,3: 16.71%
1,3,2: 16.59%
2,1,3: 16.68%
2,3,1: 16.65%
3,1,2: 16.73%
3,2,1: 16.64%
```

## Prévention

### Code Review Checklist

- [ ] Vérifier tous les `.sort(() => Math.random() - 0.5)` dans le projet
- [ ] Remplacer par `shuffle()` Fisher-Yates
- [ ] Ajouter un test de randomisation dans les tests unitaires

### Lint Rule (ESLint)

```json
{
	"rules": {
		"no-restricted-syntax": [
			"error",
			{
				"selector": "CallExpression[callee.property.name='sort'][arguments.0.type='ArrowFunctionExpression']",
				"message": "Use Fisher-Yates shuffle instead of .sort(() => Math.random() - 0.5)"
			}
		]
	}
}
```

## Références

- [Fisher-Yates Shuffle (Wikipedia)](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)
- [The Danger of Naive Shuffling](https://blog.codinghorror.com/the-danger-of-naivete/)
- [V8 sort() implementation](https://v8.dev/blog/array-sort) - Pourquoi `.sort(() => Math.random() - 0.5)` est biaisé
- Knuth, Donald E. (1969). _The Art of Computer Programming_, Volume 2: _Seminumerical Algorithms_

## Tags

- `algorithm`
- `shuffle`
- `randomization`
- `fisher-yates`
- `performance`

## Voir Aussi

- `pattern-test-fixtures-factories.md` - Factory pattern pour données de test
- `lessons-learned-2026-02-06-quiz-config-page.md` - Utilisation dans le quiz politique
