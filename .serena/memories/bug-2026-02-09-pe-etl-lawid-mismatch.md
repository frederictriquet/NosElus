# Bug : Mismatch scrutin ↔ loi PE par incohérence generateLawId

## Date

2026-02-09

## Symptômes

- `make etl-europarl-law-texts` n'enrichit que 2 lois au lieu de 2204
- `scrutins.lawId` ne matche pas avec `laws.id` pour les votes PE
- Liaison scrutin ↔ loi cassée pour 99,9% des votes PE

## Contexte

Le pipeline ETL PE comporte 3 modules :

1. `laws.ts` : Import des procédures législatives (table `laws`)
2. `votes.ts` : Import des votes + votes individuels (table `scrutins`)
3. `law-texts.ts` : Enrichissement descriptions (lookup via `scrutins.lawId`)

## Cause Racine : 3 bugs en cascade

### Bug 1 : Filtre `geo_areas=FRA` trop restrictif (votes.ts)

**Problème** : Le filtre API `/votes?geo_areas=FRA` ne retournait que 9 votes au lieu de 2204.

**Cause** : `geo_areas=FRA` filtre géographiquement (pays), pas par députés français. Les votes PE n'ont pas tous des députés français impliqués selon ce critère.

**Fix** : Suppression du filtre `geo_areas=FRA`, filtrage côté client via `mepIdMap` (députés français en base).

```typescript
// Avant (MAUVAIS)
return fetchHTV<HTVVoteListResponse>(`/votes?page=${page}&page_size=${pageSize}&geo_areas=FRA`);

// Après (CORRECT)
// No geo_areas filter: French MEP votes are filtered downstream via mepIdMap
return fetchHTV<HTVVoteListResponse>(`/votes?page=${page}&page_size=${pageSize}`);
```

### Bug 2 : generateLawId() ignorait le terme extrait (votes.ts + laws.ts)

**Problème** : `generateLawId('A9-0045/2024', 10)` produisait `'LWPE10-A9-0045-2024'` au lieu de `'LWPE9-A9-0045-2024'`.

**Cause** : La fonction utilisait toujours `currentTerm` (10) au lieu d'extraire le terme depuis le pattern de référence (A9- → terme 9).

**Résultat** : Les `lawId` générés dans `votes.ts` et `laws.ts` ne correspondaient pas → 2 matches au lieu de 2204.

**Fix** : Extraction du terme via regex `/[ABC](\d+)-/` avec fallback.

```typescript
// Avant (MAUVAIS)
export function generateLawId(reference: string, fallbackTerm: number): string {
	return `LWPE${fallbackTerm}-${reference.replace(/\//g, '-')}`;
}

// Après (CORRECT)
export function generateLawId(reference: string, fallbackTerm: number): string {
	const term = extractTermFromReference(reference) ?? fallbackTerm;
	return `LWPE${term}-${reference.replace(/\//g, '-')}`;
}
```

### Bug 3 : Regex incohérentes entre modules (votes.ts ≠ laws.ts)

**Problème** : `votes.ts` utilisait `/[A-Z](\d+)-/` tandis que `laws.ts` utilisait `/[ABC](\d+)-/` → résultats différents.

**Risque** : Pour une référence comme `D10-0001`, votes.ts extrait 10, laws.ts extrait null → IDs différents.

**Fix** : Factorisation dans `shared.ts` → une seule regex `/[ABC](\d+)-/`.

### Bug 4 : varchar(20) trop court pour lawId (schema)

**Problème** : Les références composites comme `RC-B10-0071/2026` produisent des IDs de 23 caractères → dépassent `varchar(20)`.

**Résultat** : 309 scrutins insérés au lieu de 2204 (erreur SQL tronquage).

**Fix** : Migration `scrutins.law_id` de `varchar(20)` à `varchar(50)`.

```sql
ALTER TABLE scrutins ALTER COLUMN law_id TYPE varchar(50);
```

## Chemin de Diagnostic

1. **Observation** : `law-texts.ts` trouve 2 lois avec votes liés au lieu de 2204
2. **Hypothèse 1** : Problème de cache → Invalidé (pas de cache ici)
3. **Hypothèse 2** : Problème de lookup DB → Vérifié requête SQL OK
4. **Investigation** : Comparaison `laws.id` vs `scrutins.lawId` → 2 matches seulement
5. **Root cause** : `generateLawId()` dans votes.ts ignorait le terme extrait
6. **Discovery** : Regex différentes entre votes.ts et laws.ts (blocker code review)
7. **Factorisation** : Création de `shared.ts` pour unifier

## Solution : Factorisation dans shared.ts

Création d'un module partagé `shared.ts` exportant :

- `fetchHTV<T>()` : Client API HTV typé
- `extractTermFromReference()` : Extraction législature depuis référence
- `generateLawId()` : Génération ID unique cohérente

**Fichier** : `src/lib/server/etl/sources/europarl/shared.ts`

```typescript
export function extractTermFromReference(reference: string): number | null {
	const match = reference.match(/[ABC](\d+)-/);
	return match ? parseInt(match[1], 10) : null;
}

export function generateLawId(reference: string, fallbackTerm: number): string {
	const term = extractTermFromReference(reference) ?? fallbackTerm;
	return `LWPE${term}-${reference.replace(/\//g, '-')}`;
}
```

**Importé par** : `votes.ts`, `laws.ts`, `law-texts.ts`

## Résultat

- ✅ 2204 scrutins avec `lawId` cohérents (au lieu de 2)
- ✅ 2204 matches scrutin ↔ loi (au lieu de 2)
- ✅ Enrichissement PE functional (2204 lois enrichissables)

## Prévention

1. **Tests de non-régression** : 54 tests ajoutés
   - `shared.test.ts` : 25 tests (extraction + génération)
   - `votes.test.ts` : 10 tests (régression terme)
   - `law-texts.test.ts` : 19 tests (assemblage textes)

2. **Documentation** : README.md + JSDoc complets

3. **Pattern** : Factoriser toute fonction générant des IDs servant de foreign key

## Tags

- type: data-integrity, id-generation, cascading-bugs
- module: europarl-etl
- severity: critical (99,9% données inaccessibles)
