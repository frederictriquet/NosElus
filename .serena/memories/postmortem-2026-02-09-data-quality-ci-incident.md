# Post-Mortem : Incident CI sur PR Data Quality Dashboard

## Date : 2026-02-09

## PR : #18

## Résumé

Lors du pre-merge de la PR #18 (data quality dashboard), la CI a échoué car les tests
d'intégration (`page.server.test.ts`) tentaient de se connecter à PostgreSQL absent en CI.
Un fix précipité (ajout service PostgreSQL + `db:push`) a aggravé la situation car `drizzle-kit push`
est interactif et bloque. La solution finale : exclure `*.server.test.ts` de `vitest run` par défaut.

## Cause Racine

Le projet n'avait pas de convention dans `vitest.config.ts` pour séparer tests unitaires
(exécutables partout) des tests d'intégration (nécessitant une DB réelle).

## Impact

- CI bloquée ~30min
- 3 commits de correction nécessaires
- Perte de temps sur un fix incorrect (PostgreSQL service dans CI)

## Actions Prises

1. ✅ Ajout `exclude: ['src/**/*.server.test.ts']` dans vitest.config.ts
2. ✅ Revert du service PostgreSQL dans ci.yml
3. ⬜ Ajouter `npm run test:integration` pour lancer les tests DB séparément
4. ⬜ Documenter la convention : `*.test.ts` = unit, `*.server.test.ts` = intégration

## Leçons Apprises

1. **Ne jamais modifier la CI sous pression** : vérifier en local si les outils sont interactifs
2. **`drizzle-kit push` est interactif** : il attend une confirmation, inutilisable en CI sans --force ou alternative
3. **Convention vitest** : les tests `*.server.test.ts` nécessitent une DB réelle → exclus par défaut
4. **Le pattern `pattern-integration-tests-real-db.md` existait déjà** mais n'avait pas été reflété dans la config vitest globale

## Prévention Future

- Tout nouveau test d'intégration DB doit être nommé `*.server.test.ts`
- La config vitest les exclut automatiquement du `npm run test`
- Pour lancer les tests DB en local : `npx vitest run src/**/**.server.test.ts`
