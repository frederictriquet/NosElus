# Tests : Law Implication Helpers (Phase 2.2)

## Date : 2026-02-01

## Fichier de test

`src/lib/server/api/helpers.law-implication.test.ts`

## Framework

**Vitest** - Tests d'intégration avec base de données réelle

## Fonctions testées

### 1. `getActorLawsImplication(actorId, limit)`

Récupère les textes de loi signés par un acteur.

| Cas de test | Input | Expected | Status |
|-------------|-------|----------|--------|
| Acteur inexistant | `PA999999` | `[]` | ✅ |
| Acteur avec textes | ID réel | `length > 0` | ✅ |
| Respect de limit | `limit=3` | `length <= 3` | ✅ |
| Tri par date | Acteur réel | Dates DESC | ✅ |
| Rôles valides | Acteur réel | `author` ou `cosignatory` | ✅ |

### 2. `getLawContributors(lawId)`

Récupère les contributeurs (auteurs et cosignataires) d'un texte.

| Cas de test | Input | Expected | Status |
|-------------|-------|----------|--------|
| Texte inexistant | `NONEXISTENT_LAW_ID` | `[]` | ✅ |
| Texte avec contributeurs | ID réel | `length > 0` | ✅ |
| Tri par ordre signature | Texte réel | signature_order ASC | ✅ |
| Rôles valides | Texte réel | `author` ou `cosignatory` | ✅ |
| Pas de doublons | Texte réel | `actorId` uniques | ✅ |
| Format nom | Texte réel | `"FirstName LastName"` | ✅ |

### 3. Cohérence cross-fonction

| Test | Vérification | Status |
|------|--------------|--------|
| Réciprocité | Si acteur signe texte, alors acteur dans contributeurs | ✅ |

## Résultats

```
✓ src/lib/server/api/helpers.law-implication.test.ts (11 tests) 155ms

Test Files  1 passed (1)
     Tests  11 passed (11)
  Duration  2.49s
```

## Stratégie adoptée

**Tests d'intégration** plutôt qu'unitaires car :
- Requêtes SQL complexes avec jointures multiples
- Comportement dépend de la structure exacte de la DB
- Données de test déjà présentes (4684 cosignataires)
- Valeur ajoutée dans la vérification de l'intégration complète

## Setup des tests

- `beforeAll` : Trouve un acteur et un texte avec données pour les tests
- Fallback gracieux avec `console.warn` si aucune donnée test disponible
- Pas de cleanup nécessaire (tests en lecture seule)

## Cas non couverts (justifiés)

- **Performances avec grandes quantités** : Non critique car limits appliqués
- **Erreurs DB** : Gérées par Drizzle ORM, pas de logique custom
- **Cas de corruption de données** : Intégrité garantie par FK

## Commande

```bash
npm test -- helpers.law-implication.test.ts
```

## Prochaine étape

→ `/test-run` pour exécuter tous les tests du projet
