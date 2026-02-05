# Workflow Actif - Migration Positions PE vers DB

## Tâche
Migrer le mapping hardcodé `EU_GROUP_POSITIONS` (positions politiques groupes PE) vers la base de données

## Objectif
Éliminer le hardcoding des positions PE en les stockant dans `organs.political_position`, conformément à la règle `no-hardcoding-rule`.

**Critère de succès** : `EU_GROUP_POSITIONS` n'existe plus dans le code, données en DB, `/pe/carte` fonctionne.

## Démarré
2026-02-05 18:05

## Historique
| Timestamp | Skill | Status | Notes |
|-----------|-------|--------|-------|
| 18:05 | /analyze | ✅ | Problème clarifié, pattern existant identifié |
| 18:47 | /implement | ✅ | Script seed créé, determinePosition() modifié, Makefile mis à jour |
| 10:15 | /test-run | ✅ | 198/198 tests passent, script idempotent validé |
| 10:16 | /code-review | 🔄 | 3 issues : effet de bord ETL, .PHONY, suppression constante |
| 10:24 | corrections | ✅ | EU_GROUP_POSITIONS supprimé, import protégé, .PHONY corrigé |
| 10:30 | /document | ✅ | Docs features + README ParlGov mis à jour |
| 10:30 | /capitalize | ✅ | Leçons sauvegardées dans SERENA |
| 10:30 | /roadmap-update | ✅ | Section 4.6 mise à jour |

## Phase Actuelle
/analyze ✅ → /implement ✅ → /test-run ✅ → /code-review ✅ → **/pre-merge**

## Contexte Clé
- Constante `EU_GROUP_POSITIONS` dans `types.ts` (20 groupes PE)
- Utilisée dans `determinePosition()` ligne 287
- Pattern: script seed similaire à `import-external-colors.ts`
- Colonne DB `political_position` déjà existante (migration 0009)
- Source académique: Chapel Hill Expert Survey

## Décisions Prises
- Approche: Script seed SQL/TS (pas de migration complexe)
- Rejoignable: UPDATE avec WHERE shortName IN (...)
- Pas d'automatisation Chapel Hill (données manuelles OK)

## Fichiers Concernés
### Créés ✅
- `scripts/etl/seed-pe-positions.ts` - Script de seed pour positions PE

### Modifiés ✅
- `src/lib/server/etl/sources/parlgov/matcher.ts` - determinePosition() nettoyé (plus de hardcoding)
- `src/lib/server/etl/sources/parlgov/types.ts` - EU_GROUP_POSITIONS supprimé
- `scripts/etl/import-political-positions.ts` - Protection contre écrasement des positions seedées
- `Makefile` - Target `etl-seed-pe-positions` ajouté + `.PHONY`

## Implémentation Réalisée
✅ Script `seed-pe-positions.ts` créé (pattern: import-external-colors.ts)
✅ `EU_GROUP_POSITIONS` supprimé de types.ts (plus de hardcoding)
✅ `determinePosition()` nettoyé : fonction pure ParlGov sans hardcoding
✅ `import-political-positions.ts` protégé : ne pas écraser les positions seedées
✅ Target Makefile `etl-seed-pe-positions` ajouté + `.PHONY` corrigé
✅ Tous les tests passent (198/198)

## Résultats Tests
✅ **198/198 tests passent** (100% - aucune régression)
✅ **19 tests de position** (determinePosition()) - tous passent
✅ **Script idempotent** - 43 groupes PE confirmés en DB, 2 noms alternatifs manquants
✅ **Aucune erreur TypeScript**

## Prochaine Étape
**/pre-merge** - Préparer et valider la branche avant merge
