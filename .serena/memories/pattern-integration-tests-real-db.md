# Pattern : Tests d'Intégration avec Base de Données Réelle

## Date : 2026-02-01

## Problème

Tester des helpers qui font des requêtes SQL complexes (jointures, agrégations) avec des mocks est :

- Fastidieux (mocker Drizzle ORM est complexe)
- Peu fiable (ne teste pas les vraies requêtes SQL)
- Fragile (casse si l'ORM change)

## Contexte

Fonctions faisant des requêtes SQL avec :

- Jointures multiples
- Agrégations (count, group by)
- Tri complexe
- Dépendances à la structure exacte de la DB

## Solution

Utiliser la **vraie base de données** dans les tests d'intégration.

### Setup Vitest

```typescript
// helpers.law-implication.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { db, lawCosignatories, laws, actors } from '$lib/server/db';
import { getActorLawsImplication, getLawContributors } from './helpers';

describe('Law Implication Helpers - Integration', () => {
	let testActorId: string | null = null;
	let testLawId: string | null = null;

	beforeAll(async () => {
		// Find real test data from existing DB
		const [actorWithLaws] = await db
			.selectDistinct({ actorId: lawCosignatories.actorId })
			.from(lawCosignatories)
			.limit(1);

		testActorId = actorWithLaws?.actorId || null;
	});

	it('should return laws signed by actor when actor exists', async () => {
		if (!testActorId) {
			console.warn('No test actor found, skipping test');
			return;
		}

		const result = await getActorLawsImplication(testActorId, 10);

		expect(result.length).toBeGreaterThan(0);
		expect(result[0]).toHaveProperty('lawId');
		expect(['author', 'cosignatory']).toContain(result[0].role);
	});
});
```

## Avantages

✅ **Tests réalistes** : Valide les vraies requêtes SQL
✅ **Pas de mocks** : Moins de code de test
✅ **Détection précoce** : Les bugs SQL sont détectés immédiatement
✅ **Validation complète** : Teste ORM + DB + indexes
✅ **Maintenance simple** : Pas de mocks à maintenir

## Inconvénients

⚠️ **Dépend de la DB** : Nécessite une DB de test avec données
⚠️ **Plus lent** : ~200ms vs <10ms pour tests unitaires purs
⚠️ **State partagé** : Risque si tests modifient les données

## Bonnes Pratiques

### 1. Utiliser des données existantes

```typescript
beforeAll(async () => {
	// ✅ Bon : Utilise les données réelles
	const [testData] = await db.select().from(table).limit(1);

	// ❌ Mauvais : Insert des fixtures à chaque test
	// await db.insert(table).values(mockData);
});
```

### 2. Graceful degradation si pas de données

```typescript
it('should work', async () => {
	if (!testData) {
		console.warn('No test data, skipping');
		return; // Test passe sans fail
	}

	// Test normal
});
```

### 3. Tests en lecture seule

```typescript
// ✅ Bon : Pas de modification
const result = await db.select().from(table);

// ❌ Éviter : Modifications (sauf si cleanup)
await db.update(table).set({ field: 'new value' });
```

### 4. Pas de cleanup nécessaire si read-only

```typescript
// afterEach(() => {
//   // Pas besoin si tests en lecture seule
// });
```

## Exemple Réel : Phase 2.2

**Fichier** : `src/lib/server/api/helpers.law-implication.test.ts`

**Résultats** :

- 11 tests d'intégration
- 100% passants
- Durée : 165ms (acceptable)
- Couverture : empty cases, valid data, limits, sorting, uniqueness

**Cas testés** :

1. Acteur inexistant → `[]`
2. Acteur avec textes → structure validée
3. Respect du limit parameter
4. Tri par date DESC
5. Rôles valides (author/cosignatory)
6. Pas de doublons
7. Cross-validation entre helpers

## Quand Utiliser ce Pattern

| Situation               | Recommandation                 |
| ----------------------- | ------------------------------ |
| Requêtes SQL simples    | Tests unitaires avec mocks OK  |
| Requêtes avec jointures | ✅ Tests intégration DB réelle |
| Agrégations complexes   | ✅ Tests intégration DB réelle |
| Logique métier pure     | Tests unitaires                |
| ETL scripts             | ✅ Tests intégration DB réelle |

## Alternative : DB in-memory

Pour des tests encore plus rapides :

```typescript
// Utiliser SQLite in-memory pour tests
const testDb = drizzle(new Database(':memory:'));
```

**Avantages** : Plus rapide, isolation totale
**Inconvénients** : Ne teste pas PostgreSQL réel (différences SQL)

## Convention de Nommage (ajouté 2026-02-09)

- `*.test.ts` = tests unitaires → tournent partout (CI + local)
- `*.server.test.ts` = tests d'intégration DB → local seulement

**Config vitest.config.ts** :

```typescript
exclude: ['src/**/*.server.test.ts', 'node_modules'];
```

Les tests d'intégration sont exclus de `npm run test` par défaut.
Pour les lancer en local : `npx vitest run src/**/*.server.test.ts`

Voir : `postmortem-2026-02-09-data-quality-ci-incident.md` pour le contexte.

## Commande

```bash
# Tests unitaires seulement (CI-safe)
npm test

# Tests d'intégration DB (local seulement)
npx vitest run src/**/*.server.test.ts
```

## Références

- Tests écrits : `src/lib/server/api/helpers.law-implication.test.ts`
- Commit : `50be732`
- Documentation : `.serena/memories/tests-law-implication-2026-02-01.md`
