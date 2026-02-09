# Pattern : Tri Naturel des Strings Numériques

## Problème

Le tri lexicographique de strings contenant des nombres produit un ordre non naturel :

```
Lexicographique : "1", "10", "17", "2", "20"
Attendu (naturel) : "1", "2", "10", "17", "20"
```

Ce problème est fréquent pour :
- Numéros de législatures/mandatures
- Versions ("v1", "v10", "v2")
- Numéros de chapitres/sections
- IDs préfixés avec numéros

## Contexte

**Quand utiliser** : Tri d'identifiants ou labels contenant des nombres destinés à être affichés dans un ordre logique pour l'utilisateur.

**Alternative** : Si les IDs sont purement techniques (UUIDs, timestamps), le tri lexicographique est acceptable.

## Solution

Extraire la partie numérique pour tri, tout en conservant la string originale pour l'affichage.

### Implémentation TypeScript

```typescript
/**
 * Extrait le premier nombre trouvé dans une string pour permettre un tri naturel.
 *
 * @param str - String contenant un ou plusieurs nombres
 * @returns Le premier nombre trouvé, ou 0 si aucun
 *
 * @example
 * extractNumber('17')         // → 17
 * extractNumber('PE-10')      // → 10
 * extractNumber('SE-2023')    // → 2023
 * extractNumber('v2.1.0')     // → 2 (premier nombre)
 * extractNumber('no-number')  // → 0
 */
function extractNumber(str: string): number {
  const match = str.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Trie un tableau de strings de manière naturelle.
 *
 * @example
 * const items = ['1', '10', '2', '20'];
 * items.sort((a, b) => extractNumber(a) - extractNumber(b));
 * // → ['1', '2', '10', '20']
 */
```

### Usage avec des objets

```typescript
interface Legislature {
  id: string;  // "17", "PE-10", etc.
  name: string;
}

// Tri par ID de mandature en ordre naturel
legislatures.sort((a, b) => extractNumber(a.id) - extractNumber(b.id));
```

### Pattern : Configuration Déclarative

Pour éviter de coder en dur la logique d'extraction à chaque tri :

```typescript
interface ColumnConfig {
  key: string;
  getValue: (row: any) => number;  // Fonction d'extraction
}

const COLUMNS: ColumnConfig[] = [
  {
    key: 'legislature',
    getValue: (row) => extractNumber(row.legislature)  // Tri naturel
  },
  {
    key: 'totalLaws',
    getValue: (row) => row.totalLaws  // Tri numérique direct
  }
];

// Tri générique
function sortBy(data: any[], column: string, direction: 'asc' | 'desc') {
  const col = COLUMNS.find(c => c.key === column);
  if (!col) return data;
  
  const mult = direction === 'asc' ? 1 : -1;
  return [...data].sort((a, b) => mult * (col.getValue(a) - col.getValue(b)));
}
```

## Avantages

- ✅ **UX améliorée** : Ordre logique pour l'utilisateur
- ✅ **Simplicité** : Regex simple, 1 ligne
- ✅ **Performance** : O(n log n) comme tout tri, extraction O(1)
- ✅ **Type-safe** : TypeScript valide les types

## Inconvénients

- ⚠️ Ne gère qu'un seul nombre (extrait le premier)
- ⚠️ Ne gère pas les versions complexes (ex: "v2.10" vs "v2.9")

## Alternatives

### Pour versions sémantiques complexes

Utiliser une bibliothèque comme `semver` :

```typescript
import semver from 'semver';

versions.sort((a, b) => semver.compare(a, b));
```

### Pour tri multi-critères

```typescript
// Tri par numéro, puis par préfixe si égalité
items.sort((a, b) => {
  const numDiff = extractNumber(a) - extractNumber(b);
  if (numDiff !== 0) return numDiff;
  return a.localeCompare(b);  // Fallback lexicographique
});
```

## Exemples d'utilisation dans le projet

- **`/stats/data-quality`** : Tri des mandatures AN/PE/SENAT
  - `src/routes/stats/data-quality/page.helpers.ts:extractLegislatureNumber()`
  - Trie "1", "2", "10", "17" au lieu de "1", "10", "17", "2"

## Cas réels testés

```typescript
// Tests unitaires pour vérifier le comportement
describe('extractNumber', () => {
  it('should extract from AN legislature', () => {
    expect(extractNumber('17')).toBe(17);
    expect(extractNumber('1')).toBe(1);
  });

  it('should extract from PE legislature', () => {
    expect(extractNumber('PE-10')).toBe(10);
  });

  it('should extract from Sénat legislature', () => {
    expect(extractNumber('SE-2023')).toBe(2023);
  });

  it('should return 0 for non-numeric', () => {
    expect(extractNumber('')).toBe(0);
    expect(extractNumber('abc')).toBe(0);
  });
});
```

## Voir aussi

- Pattern : Configuration Déclarative des Colonnes (tri générique)
- [Intl.Collator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator) pour tri localisé avancé
- [semver](https://www.npmjs.com/package/semver) pour versions sémantiques

## Date d'adoption

2026-02-09
