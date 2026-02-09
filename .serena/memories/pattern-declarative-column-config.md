# Pattern : Configuration Déclarative des Colonnes

## Problème

Le rendu de tableaux avec tri interactif mène souvent à :

1. **Duplication** : Labels et logique de tri codés en dur dans le template
2. **Maintenance** : Ajouter une colonne = modifier template + logique de tri
3. **Type safety** : Risque de typos entre template et fonctions de tri

```svelte
<!-- ❌ Code en dur, difficile à maintenir -->
<th onclick={() => sort('legislature')}>Mandature</th>
<th onclick={() => sort('totalLaws')}>Lois</th>
<th onclick={() => sort('votes')}>Avec votes</th>
<!-- ... 7 colonnes × 3 lignes de code = beaucoup de duplication -->

<script>
function sort(column: string) {
  if (column === 'legislature') {
    // logique spécifique legislature
  } else if (column === 'totalLaws') {
    // logique spécifique totalLaws
  } 
  // ... répété pour chaque colonne
}
</script>
```

## Contexte

**Quand utiliser** :
- Tableaux avec ≥3 colonnes triables
- Colonnes avec logique de tri différente (texte, nombre, pourcentage, date)
- Besoin d'uniformité visuelle (alignement, labels)

**Alternative** : Pour 1-2 colonnes simples, le code en dur est acceptable.

## Solution

Définir une configuration déclarative des colonnes, générer l'UI en boucle.

### Structure de base

```typescript
/**
 * Configuration d'une colonne triable.
 */
interface ColumnConfig<T> {
  /** Identifiant unique de la colonne (clé de tri) */
  key: string;
  /** Label affiché dans l'en-tête */
  label: string;
  /** Alignement du texte */
  align: 'left' | 'right' | 'center';
  /**
   * Fonction d'extraction de la valeur de tri.
   * Retourne un nombre pour permettre tri uniforme : a - b
   */
  getValue: (row: T) => number;
}
```

### Exemple concret

```typescript
// Types
type SortableColumn = 'legislature' | 'totalLaws' | 'votes' | 'ai';

interface LegislatureStats {
  legislature: string;
  totalLaws: number;
  lawsWithVotes: number;
  lawsWithSummaries: number;
}

// Configuration déclarative (1 source de vérité)
const COLUMNS: ColumnConfig<LegislatureStats>[] = [
  {
    key: 'legislature',
    label: 'Mandature',
    align: 'left',
    getValue: (row) => extractNumber(row.legislature)  // Tri naturel
  },
  {
    key: 'totalLaws',
    label: 'Lois',
    align: 'right',
    getValue: (row) => row.totalLaws  // Tri numérique direct
  },
  {
    key: 'votes',
    label: 'Avec votes',
    align: 'right',
    getValue: (row) => (row.lawsWithVotes / row.totalLaws) * 100  // Tri par %
  },
  {
    key: 'ai',
    label: 'Analysées IA',
    align: 'right',
    getValue: (row) => (row.lawsWithSummaries / row.totalLaws) * 100
  }
];
```

### Rendu générique (template)

```svelte
<script lang="ts">
  import { COLUMNS, sortData } from './helpers';
  
  let sortColumn = $state<SortableColumn>('legislature');
  let sortDirection = $state<'asc' | 'desc'>('asc');
  
  function handleSort(column: SortableColumn) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }
  
  $: sorted = sortData(data, sortColumn, sortDirection);
</script>

<table>
  <thead>
    <tr>
      {#each COLUMNS as col}
        <th 
          class="{col.align === 'right' ? 'text-right ' : ''}sortable"
          onclick={() => handleSort(col.key)}
        >
          {col.label}
          {#if sortColumn === col.key}
            <span class="arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>
          {/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each sorted as row}
      <tr>
        <td>{formatLegislature(row.legislature)}</td>
        <td class="text-right">{row.totalLaws}</td>
        <td class="text-right">{row.lawsWithVotes} ({percentage(row)}%)</td>
        <td class="text-right">{row.lawsWithSummaries} ({percentageAI(row)}%)</td>
      </tr>
    {/each}
  </tbody>
</table>
```

### Fonction de tri uniforme

```typescript
/**
 * Map pré-calculée pour accès O(1) aux configs.
 * Alternative : find() à chaque tri = O(n).
 */
const COLUMNS_MAP = new Map(COLUMNS.map(c => [c.key, c]));

/**
 * Trie les données de manière générique selon la configuration.
 */
function sortData<T>(
  data: T[], 
  column: SortableColumn, 
  direction: 'asc' | 'desc'
): T[] {
  const col = COLUMNS_MAP.get(column);
  if (!col) return data;
  
  const mult = direction === 'asc' ? 1 : -1;
  return [...data].sort((a, b) => mult * (col.getValue(a) - col.getValue(b)));
}
```

## Avantages

- ✅ **DRY** : 1 source de vérité pour labels, alignement, tri
- ✅ **Type-safe** : TypeScript valide les clés de colonnes
- ✅ **Maintenabilité** : Ajouter une colonne = 1 entrée dans COLUMNS
- ✅ **Uniformité** : Tri uniforme via getValue(), pas de if/else
- ✅ **Performance** : Map pré-calculée = O(1) lookup

## Inconvénients

- ⚠️ Overhead pour <3 colonnes (code en dur plus simple)
- ⚠️ getValue() limité aux nombres (besoin d'adapter pour strings/dates)

## Extensions possibles

### Support tri strings

```typescript
interface ColumnConfig<T> {
  key: string;
  label: string;
  align: 'left' | 'right';
  getValue: (row: T) => number | string;  // Support mixte
  type: 'number' | 'string';  // Indiquer le type
}

function sortData<T>(data: T[], column: string, direction: 'asc' | 'desc') {
  const col = COLUMNS_MAP.get(column);
  if (!col) return data;
  
  const mult = direction === 'asc' ? 1 : -1;
  return [...data].sort((a, b) => {
    const valA = col.getValue(a);
    const valB = col.getValue(b);
    
    if (col.type === 'number') {
      return mult * ((valA as number) - (valB as number));
    } else {
      return mult * (valA as string).localeCompare(valB as string);
    }
  });
}
```

### Colonnes conditionnelles

```typescript
const COLUMNS = [
  { key: 'id', label: 'ID', ... },
  ...(isAdmin ? [{ key: 'actions', label: 'Actions', ... }] : [])
];
```

### Formatage personnalisé

```typescript
interface ColumnConfig<T> {
  // ...
  format?: (row: T) => string;  // Optionnel
}

// Dans le template
<td>{col.format ? col.format(row) : col.getValue(row)}</td>
```

## Exemples d'utilisation dans le projet

- **`/stats/data-quality`** : 7 colonnes triables
  - `src/routes/stats/data-quality/page.helpers.ts:COLUMNS`
  - Legislature (tri naturel), totalLaws (numérique), 4 pourcentages, scrutins
  - Template génère les <th> via `{#each COLUMNS}`

## Tests

```typescript
describe('sortData', () => {
  const testData = [
    { legislature: '17', totalLaws: 100 },
    { legislature: '1', totalLaws: 50 },
    { legislature: '10', totalLaws: 200 }
  ];

  it('should sort by legislature naturally', () => {
    const result = sortData(testData, 'legislature', 'asc');
    expect(result.map(r => r.legislature)).toEqual(['1', '10', '17']);
  });

  it('should sort by totalLaws numerically', () => {
    const result = sortData(testData, 'totalLaws', 'asc');
    expect(result.map(r => r.totalLaws)).toEqual([50, 100, 200]);
  });

  it('should not mutate original array', () => {
    const original = [...testData];
    sortData(testData, 'legislature', 'asc');
    expect(testData).toEqual(original);
  });
});
```

## Voir aussi

- Pattern : Tri Naturel des Strings Numériques (extractNumber)
- [Intl.Collator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator) pour tri localisé
- [TanStack Table](https://tanstack.com/table) pour tableaux complexes

## Date d'adoption

2026-02-09
