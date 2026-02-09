# Lessons Learned : Définition de "Texte Complet" (2026-02-09)

## Catégorie
Data Quality / ETL / LLM Analysis

## Date
2026-02-09

## Contexte

### Incident découvert
Dashboard data-quality affichait **100% des lois PE avec résumés IA** mais **0% avec texte complet**.
Cela violait la règle "pas de résumé IA sans texte complet réel".

### Investigation
- 1190 résumés LLM générés pour des lois PE
- Descriptions PE = 25-58 chars : "Proposition de résolution", "Rapport", etc.
- Ces "résumés IA" étaient en réalité des **paraphrases de titres** (hallucinations)

### Root Cause
**Incohérence de définition** entre deux parties du système :

| Composant | Filtre utilisé | Définition "texte complet" |
|-----------|----------------|----------------------------|
| **Dashboard** (`+page.server.ts:175`) | `length(description) > 100` | Description > 100 chars |
| **ETL LLM** (`law-analyzer.ts:254`) | `isNotNull(description)` ❌ | Description non-null |

L'ETL analysait des descriptions de 25 chars comme du "texte complet".

## Symptômes Observés

1. **Dashboard incohérent** : 100% résumés IA vs 0% textes complets (PE)
2. **Quiz cassé** : Quiz PE proposait 2 lois sans texte (juste paraphrases de titres)
3. **Données corrompues** : 1190 résumés LLM sans valeur réelle en DB

## Impact

| Métrique | Valeur |
|----------|--------|
| Résumés invalides | 1190 (PE-8: 5, PE-9: 821, PE-10: 364) |
| Tags associés supprimés | 2315 |
| Chambres affectées | Parlement Européen uniquement |
| AN/Sénat affectés | Non (descriptions > 100 chars) |

## Solution Appliquée

### 1. Code Fix
Remplacé dans **4 fichiers** :
```typescript
// ❌ AVANT
isNotNull(laws.description)

// ✅ APRÈS
gt(sql`length(${laws.description})`, 100)
```

**Fichiers modifiés** :
- `src/lib/server/etl/sources/llm/law-analyzer.ts:255`
- `src/routes/debug/+page.server.ts:68`
- `src/routes/debug/+page.server.ts:75`

### 2. DB Cleanup
```sql
-- Suppression des résumés PE invalides
DELETE FROM law_tags WHERE law_id IN (
  SELECT ls.law_id FROM law_summaries ls
  JOIN laws l ON ls.law_id = l.id
  WHERE l.legislature LIKE 'PE-%'
);
DELETE FROM law_summaries WHERE law_id IN (
  SELECT id FROM laws WHERE legislature LIKE 'PE-%'
);
```

### 3. Tests Créés
- **Unit tests** (`law-analyzer.test.ts`) : 6 tests documentant le contrat
- **Integration tests** (`law-analyzer.server.test.ts`) : 6 tests validant le filtre SQL

## Learnings

### 1. ⚠️ Risque : Définitions Implicites
**Problème** : "Texte complet" avait deux définitions différentes dans le code.

**Cause** : Pas de constante partagée ni de documentation explicite du seuil.

**Solution future** : Constante partagée ou au minimum documentation claire dans JSDoc.

### 2. ✅ Pattern : Tests d'Intégration DB
**Adopté** : Convention `*.server.test.ts` pour tests nécessitant DB réelle.

**Bénéfice** : Validation des requêtes SQL réelles sans mocks complexes.

**Config** : Exclus de CI via `vitest.config.ts` (voir `pattern-integration-tests-real-db.md`).

### 3. ✅ Pattern : Validation Cross-Component
**Découverte** : Le dashboard utilisait le bon filtre depuis le début.

**Learning** : Quand un composant fait une agrégation/stat, son critère peut servir de **référence** pour aligner les autres composants.

### 4. 🔍 Détection Précoce : Dashboard comme Outil de QA
**Observation** : L'incohérence était **visible** dans le dashboard (100% vs 0%).

**Learning** : Les dashboards de data-quality ne sont pas que des métriques, ils révèlent des **bugs de logique métier**.

## Prévention Future

### Checklist : Filtres "Texte Complet"
Quand on ajoute un nouveau composant utilisant `laws.description` :

- [ ] Vérifier quel filtre est utilisé ailleurs dans le projet
- [ ] Si incohérence possible, créer une constante ou helper partagé
- [ ] Ajouter un test d'intégration validant le filtre
- [ ] Documenter la définition dans JSDoc

### Convention Établie
**Seuil officiel** : `length(description) > 100` = texte complet analysable

**Justification** :
- "Proposition de résolution" (25 chars) = label, pas du texte
- Descriptions > 100 chars contiennent généralement un résumé exploitable
- Cohérent entre AN, Sénat et PE

### Constante Suggérée (pour futur refactor)
```typescript
// src/lib/server/db/constants.ts
/**
 * Seuil minimal pour considérer une description comme "texte complet".
 * 
 * Les descriptions courtes (≤100 chars) sont des labels génériques
 * comme "Proposition de résolution" qui ne contiennent pas de texte analysable.
 */
export const MIN_DESCRIPTION_LENGTH = 100;
```

## Tests de Régression

### Validation Manuelle Post-Fix
```bash
# 1. Vérifier qu'aucune loi PE n'a de résumé
./scripts/db-query.sh "
  SELECT COUNT(*) as pe_summaries 
  FROM law_summaries ls 
  JOIN laws l ON ls.law_id = l.id 
  WHERE l.legislature LIKE 'PE-%';
"
# Attendu: 0

# 2. Dashboard cohérent (0% AI et 0% textes complets pour PE)
npm run dev
# Ouvrir /stats/data-quality → Vérifier colonnes PE
```

### Tests Automatisés
- ✅ `law-analyzer.test.ts` : Tests unitaires (6/6 pass)
- ✅ `law-analyzer.server.test.ts` : Tests intégration (6/6 pass)
- ✅ Dashboard tests : `src/routes/stats/data-quality/` (42/42 pass)

## Fichiers Modifiés

| Fichier | Type | Changements |
|---------|------|-------------|
| `law-analyzer.ts` | Code | 1 ligne : `isNotNull()` → `gt(sql\`length(...)\`, 100)` |
| `debug/+page.server.ts` | Code | 2 lignes : idem |
| `law-analyzer.test.ts` | Tests | Créé : 6 tests unitaires |
| `law-analyzer.server.test.ts` | Tests | Créé : 6 tests intégration |
| `docs/notes.md` | Doc | Contexte et scope documentés |

## Métriques

| Indicateur | Valeur |
|------------|--------|
| Temps total | ~1h30 (analyse → fix → tests → review) |
| Lignes code changées | 3 lignes production |
| Tests ajoutés | 12 (6 unit + 6 intégration) |
| Fichiers modifiés | 4 (2 code + 2 tests) |
| Commits | 1 (`3d6e997`) |

## Workflow Skills Utilisées

| Skill | Status | Notes |
|-------|--------|-------|
| `/analyze` | ✅ | Identification root cause |
| `/implement` | ✅ | Code fix + DB cleanup |
| `/test-write` | ✅ | 12 tests créés |
| `/test-run` | ✅ | 6/6 + 42/42 pass |
| `/quality-check` | ✅ | Prettier, TypeScript OK |
| `/code-review` | ✅ | Approuvé + correction page debug |
| `/document` | 🔄 | En cours |

## Références

- **Commit** : `3d6e997 fix(etl): require full text (>100 chars) before LLM analysis`
- **Pattern** : `.serena/memories/pattern-integration-tests-real-db.md`
- **Dashboard** : `src/routes/stats/data-quality/+page.server.ts:175`
- **ETL** : `src/lib/server/etl/sources/llm/law-analyzer.ts:255`

## Voir Aussi

- `pattern-integration-tests-real-db.md` - Convention `*.server.test.ts`
- `postmortem-2026-02-09-data-quality-ci-incident.md` - Incident CI lié
- `database-queries-factorization.md` - Factorisation requêtes DB

## Changelog

| Date | Modification |
|------|--------------|
| 2026-02-09 | Création suite à fix PE summaries sans texte complet |
