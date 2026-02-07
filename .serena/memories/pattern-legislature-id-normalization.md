# Pattern : Legislature ID Normalization (Multi-Table Consistency)

## Problème

Dans une base de données multi-chambres, différentes tables peuvent utiliser des formats d'identifiant de législature **incohérents** :

**Cas concret (NosElus)** :
- Table `scrutins` : `legislature = 'PE-10'` (Parlement Européen terme 10)
- Table `laws` : `legislature = 'PE-10'` (cohérent avec scrutins)
- Table `organs` : `legislature = '10'` (INCOHÉRENT, sans préfixe PE-)

**Symptôme** :
```typescript
// Requête sur organs avec legislature 'PE-10'
const groups = await db.select()
  .from(organs)
  .where(eq(organs.legislature, 'PE-10'));  // ← Retourne 0 résultats !
```

**Impact utilisateur** : Quiz PE affiche "Aucun résultat" car aucun groupe parlementaire n'est trouvé.

## Contexte

Ce pattern s'applique quand :
- ✅ Base de données multi-chambres ou multi-périodes
- ✅ Plusieurs tables avec colonnes `legislature` / `period` / `term`
- ✅ Héritage de données ETL de sources différentes
- ✅ Incohérence historique (fix coûteux en DB)

**Exemples courants** :
- Chambres parlementaires (AN, Sénat, PE)
- Versions logicielles (v1, 1.0.0, 1.x)
- Environnements (prod, production, PROD)

## Solution

### Principe : Normalisation au point d'usage

Au lieu de corriger la DB (migration coûteuse), **normaliser l'ID au moment de la requête**.

### Approche

1. **Identifier les incohérences** (audit DB)
2. **Créer un helper de normalisation** (centralisé)
3. **Documenter la logique** (commentaires + tests)
4. **Utiliser systématiquement** le helper

### Code

#### 1. Helper de normalisation

```typescript
// src/lib/quiz/config.ts

/**
 * Convertit un identifiant de législature en format organs.
 *
 * Les groupes PE (table `organs`) ont `legislature = '10'` alors que
 * les scrutins/lois PE utilisent `legislature = 'PE-10'`. Cette fonction
 * normalise l'identifiant pour les requêtes sur la table organs.
 *
 * @param legislature - Identifiant de législature (ex: '17', 'PE-10')
 * @returns L'identifiant normalisé pour organs (ex: '17', '10')
 *
 * @example
 * ```typescript
 * getOrgansLegislature('17');     // → '17' (AN, inchangé)
 * getOrgansLegislature('PE-10');  // → '10' (PE, préfixe retiré)
 * ```
 */
export function getOrgansLegislature(legislature: string): string {
  return legislature.startsWith('PE-') 
    ? legislature.slice(3)  // 'PE-10' → '10'
    : legislature;          // '17' → '17'
}
```

#### 2. Utilisation dans les requêtes

```typescript
// src/routes/api/quiz/group-votes/+server.ts
import { getOrgansLegislature } from '$lib/quiz/config';

export const POST: RequestHandler = async ({ request }) => {
  const { lawIds, legislature } = await request.json();

  // ❌ AVANT (bug)
  const groups = await db.select()
    .from(organs)
    .where(eq(organs.legislature, legislature));  // 'PE-10' ne match rien !

  // ✅ APRÈS (corrigé)
  const organsLegislature = getOrgansLegislature(legislature);  // 'PE-10' → '10'
  const groups = await db.select()
    .from(organs)
    .where(eq(organs.legislature, organsLegislature));  // Match !
};
```

#### 3. Tests

```typescript
// src/lib/quiz/config.test.ts
import { describe, it, expect } from 'vitest';
import { getOrgansLegislature } from './config';

describe('getOrgansLegislature', () => {
  it('should keep AN legislature unchanged', () => {
    expect(getOrgansLegislature('17')).toBe('17');
  });

  it('should strip PE- prefix for PE legislature', () => {
    expect(getOrgansLegislature('PE-10')).toBe('10');
  });

  it('should handle edge cases', () => {
    expect(getOrgansLegislature('PE-9')).toBe('9');
    expect(getOrgansLegislature('16')).toBe('16');
  });
});
```

## Avantages

✅ **Pas de migration DB** : Correction au niveau applicatif, pas de ALTER TABLE  
✅ **Centralisé** : Une fonction, testée une fois, utilisée partout  
✅ **Documenté** : JSDoc explique le "pourquoi" aux futurs développeurs  
✅ **Type-safe** : TypeScript force l'utilisation du helper  
✅ **Backward compatible** : Ne casse rien pour AN (legislature '17')  

## Inconvénients

⚠️ **Risque d'oubli** : Si développeur oublie d'utiliser le helper  
⚠️ **Dette technique** : Idéalement, la DB devrait être cohérente  
⚠️ **Performance** : Appel de fonction à chaque requête (négligeable en pratique)  

**Mitigation** :
- Linter custom rule : "Toute requête sur `organs.legislature` doit passer par `getOrgansLegislature()`"
- Code review : Checklist de vérification
- Tests d'intégration : Couvrir tous les cas d'usage

## Variantes

### Variante 1 : Mapping bidirectionnel

Si besoin de convertir dans les deux sens :

```typescript
export const LegislatureMapping = {
  toOrgans: (leg: string) => leg.startsWith('PE-') ? leg.slice(3) : leg,
  toScrutins: (leg: string, chamber: 'an' | 'pe') => 
    chamber === 'pe' ? `PE-${leg}` : leg
};
```

### Variante 2 : Enum strict

Si nombre de législatures limité :

```typescript
enum Legislature {
  AN_17 = '17',
  PE_10 = 'PE-10'
}

const OrgansLegislatureMap: Record<Legislature, string> = {
  [Legislature.AN_17]: '17',
  [Legislature.PE_10]: '10'
};

function getOrgansLegislature(leg: Legislature): string {
  return OrgansLegislatureMap[leg];
}
```

### Variante 3 : View SQL

Si contrôle total sur DB :

```sql
CREATE VIEW organs_normalized AS
SELECT 
  *,
  CASE 
    WHEN legislature LIKE 'PE-%' THEN SUBSTRING(legislature FROM 4)
    ELSE legislature
  END AS legislature_normalized
FROM organs;
```

## Exemples d'utilisation

### Dans NosElus

| Fichier | Usage | Ligne |
|---------|-------|-------|
| `src/lib/quiz/config.ts` | Définition du helper | 19 |
| `src/routes/api/quiz/group-votes/+server.ts` | Normalisation pour requête organs | 56 |
| `src/lib/quiz/config.test.ts` | Tests unitaires | 5-15 |

**Résultat** :
- Avant : 0 groupes PE retournés → "Aucun résultat"
- Après : 8 groupes PE retournés → Quiz fonctionne ✅

## Root Cause Analysis

**Pourquoi l'incohérence existe-t-elle ?**

1. **Source ETL différente** : `organs` vient de HowTheyVote API qui utilise `term: 10`
2. **Décision historique** : `scrutins`/`laws` utilisent `'PE-10'` pour cohérence multi-chambres
3. **Migration non effectuée** : Coût/risque de migrer `organs.legislature` élevé

**Devrait-on corriger la DB ?**

**Oui, à terme** (migration idéale) :
```sql
UPDATE organs 
SET legislature = 'PE-' || legislature 
WHERE legislature ~ '^\d+$';  -- Seulement chiffres
```

**Non, pour v1** (pragmatisme) :
- Helper applicatif suffit pour débloquer
- Migration = risque de régression
- Peut être fait en v2 avec tests exhaustifs

## Checklist de diagnostic

Si `SELECT * FROM table WHERE legislature = 'X'` retourne 0 résultats :

- [ ] Vérifier le format exact en DB : `SELECT DISTINCT legislature FROM table;`
- [ ] Comparer avec les autres tables : `SELECT DISTINCT legislature FROM other_table;`
- [ ] Chercher des préfixes/suffixes : `'PE-10'` vs `'10'` vs `'PE10'`
- [ ] Vérifier la casse : `'PE-10'` vs `'pe-10'` (case-sensitive !)
- [ ] Créer un helper de normalisation
- [ ] Tester avec vraies données
- [ ] Documenter l'incohérence

## Anti-patterns à éviter

❌ **Hardcoding dans les requêtes** :
```typescript
// ❌ MAUVAIS
const leg = legislature === 'PE-10' ? '10' : legislature;
```

❌ **Logique dupliquée** :
```typescript
// ❌ MAUVAIS (dans 5 fichiers différents)
const organsLeg = legislature.startsWith('PE-') ? legislature.slice(3) : legislature;
```

❌ **Regex complexe non testée** :
```typescript
// ❌ MAUVAIS (fragile)
const organsLeg = legislature.replace(/^PE-(\d+)$/, '$1');
```

❌ **Modification silencieuse** :
```typescript
// ❌ MAUVAIS (pas documenté, risque d'oubli)
const groups = await getGroups(legislature.slice(3));
```

## Voir aussi

- `database-queries-factorization.md` : Factorisation requêtes DB
- `pattern-multi-chamber-factorization.md` : Factorisation multi-chambres
- [Database Normalization](https://en.wikipedia.org/wiki/Database_normalization) : Théorie normalisation DB

## Références

- **Bug fix** : `src/routes/api/quiz/group-votes/+server.ts:56`
- **Helper** : `src/lib/quiz/config.ts:19`
- **Tests** : `src/routes/api/quiz/group-votes/group-votes.test.ts:198`
- **Root cause** : `src/lib/server/etl/sources/europarl/meps.ts:extractGroups()`

## Date de capitalisation

2026-02-07
