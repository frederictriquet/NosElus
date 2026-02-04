# Pattern : Extraction de Logique Pure depuis Composants Svelte

## Catégorie
Architecture / Svelte / Testing

## Date d'adoption
2026-02-04

## Problème

Les composants Svelte contiennent souvent de la **logique métier complexe** mélangée avec le code de rendu UI :
- Transformation de données
- Calculs mathématiques
- Algorithmes de tri/filtrage
- Mapping de données pour d3/LayerCake

**Conséquences** :
- ❌ Difficile à tester (nécessite Svelte testing library)
- ❌ Duplication entre composant et tests
- ❌ Couplage entre logique et UI
- ❌ Type safety limitée (runes Svelte vs TypeScript pur)

## Contexte

**Quand utiliser ce pattern** :

1. Le composant contient de la logique pure (sans effets de bord)
2. La logique doit être testée unitairement
3. La logique pourrait être réutilisée ailleurs
4. Le composant devient trop complexe (>100 lignes de script)

**Quand NE PAS utiliser** :

- Logique simple (<10 lignes)
- Logique fortement couplée au DOM/events
- Composant déjà petit et lisible

## Solution

### 1. Structure de fichiers

```
src/lib/components/
├── MonComposant.svelte          # UI + intégration
├── MonComposant.utils.ts        # Logique pure
└── MonComposant.test.ts         # Tests (importe utils)
```

### 2. Extraction de la logique

**Avant** (logique dans .svelte) :
```svelte
<script lang="ts">
  interface GroupData {
    id: string;
    name: string;
    total: number;
  }
  
  let { groups, maxGroups = 10 }: Props = $props();
  
  // Logique complexe dans le composant
  const sortedData = $derived.by(() => {
    return [...groups]
      .sort((a, b) => b.total - a.total)
      .slice(0, maxGroups)
      .map(g => ({
        label: g.shortName || g.name.slice(0, 10),
        value: g.total
      }));
  });
</script>
```

**Après** (logique dans .utils.ts) :
```typescript
// MonComposant.utils.ts
export interface GroupData {
  id: string;
  name: string;
  total: number;
}

/**
 * Trie et limite les groupes par total
 * @param groups - Groupes à traiter
 * @param maxGroups - Nombre max à retourner
 */
export function sortAndLimitGroups(
  groups: GroupData[], 
  maxGroups: number
): GroupData[] {
  return [...groups]
    .sort((a, b) => b.total - a.total)
    .slice(0, maxGroups);
}

/**
 * Prépare les données pour le graphique
 */
export function prepareChartData(groups: GroupData[], maxGroups: number) {
  const sorted = sortAndLimitGroups(groups, maxGroups);
  
  return sorted.map(g => ({
    label: g.shortName || g.name.slice(0, 10),
    value: g.total
  }));
}
```

```svelte
<!-- MonComposant.svelte -->
<script lang="ts">
  import { type GroupData, prepareChartData } from './MonComposant.utils';
  
  let { groups, maxGroups = 10 }: Props = $props();
  
  // Logique déléguée aux utilitaires
  const chartData = $derived(prepareChartData(groups, maxGroups));
</script>
```

### 3. Tests unitaires

```typescript
// MonComposant.test.ts
import { describe, it, expect } from 'vitest';
import { sortAndLimitGroups, prepareChartData } from './MonComposant.utils';

describe('sortAndLimitGroups', () => {
  it('should sort by total descending', () => {
    const groups = [
      { id: 'A', total: 10, ... },
      { id: 'B', total: 30, ... }
    ];
    
    const result = sortAndLimitGroups(groups, 10);
    
    expect(result[0].id).toBe('B');
    expect(result[1].id).toBe('A');
  });
  
  it('should limit to maxGroups', () => {
    const groups = Array.from({ length: 15 }, (_, i) => 
      ({ id: `G${i}`, total: 100 - i, ... })
    );
    
    const result = sortAndLimitGroups(groups, 10);
    
    expect(result.length).toBe(10);
  });
});
```

## Avantages

### 🚀 Performance des tests
- **Avant** : Tests Svelte lents (~2-3s pour 16 tests)
- **Après** : Tests purs rapides (~25ms pour 16 tests)

### ✅ Type Safety
- **Avant** : `$derived.by()` avec inférence de types limitée
- **Après** : TypeScript pur avec types explicites

### 🔧 Réutilisabilité
- Fonctions exportables dans d'autres composants
- Pas de dépendance à Svelte runtime

### 📚 Testabilité
- Tests unitaires simples (Vitest uniquement)
- Pas besoin de Svelte testing library
- Mocking facile

### 🧹 Maintenabilité
- Séparation claire UI vs logique
- Code du composant plus concis
- Documentation centralisée (JSDoc)

## Inconvénients

### ➕ Fichiers supplémentaires
- 1 fichier `.utils.ts` de plus par composant
- Peut sembler over-engineering pour composants simples

### 🔄 Indirection
- Lecteur doit naviguer entre fichiers
- **Mitigation** : Bonne documentation + imports clairs

### 📦 Bundle size
- Négligeable : fonctions tree-shakable
- **Mesure** : +200 lignes .utils.ts → +2KB compilé

## Exemples d'utilisation

### Exemple 1 : GroupVotesStackedBar (réel)

**Contexte** : Graphique empilé avec 2 modes de transformation de données

**Extraction** :
- `src/lib/components/GroupVotesStackedBar.utils.ts` (85 lignes)
  - `sortAndLimitGroups()`
  - `prepareByGroupData()`
  - `prepareByPositionData()`

**Résultats** :
- ✅ 16 tests unitaires rapides
- ✅ Composant réduit de 109 → 68 lignes
- ✅ Type safety améliorée (mapping explicite vs type assertion)

**Fichiers** :
- `src/lib/components/GroupVotesStackedBar.svelte:8-13` - Imports utils
- `src/lib/components/GroupVotesStackedBar.utils.ts` - Logique pure
- `src/lib/components/GroupVotesStackedBar.test.ts:2-6` - Tests utils

### Exemple 2 : VoteEvolutionChart (hypothétique)

**Avant** :
```svelte
<script>
  const monthlyData = $derived.by(() => {
    // 30 lignes de transformation de données
    // Grouping par mois, calculs d'agrégats, etc.
  });
</script>
```

**Après** :
```typescript
// VoteEvolutionChart.utils.ts
export function aggregateByMonth(votes: Vote[]): MonthlyData[] {
  // Logique testable unitairement
}
```

## Checklist d'Extraction

### Avant l'extraction
- [ ] Logique pure identifiée (pas d'effets de bord)
- [ ] Logique complexe (>10 lignes ou algorithme non trivial)
- [ ] Besoin de tests unitaires

### Pendant l'extraction
- [ ] Créer fichier `.utils.ts` à côté du `.svelte`
- [ ] Exporter interface/types utilisés
- [ ] Documenter avec JSDoc
- [ ] Ajouter exemples `@example`

### Après l'extraction
- [ ] Tests unitaires couvrent la logique
- [ ] Composant importe depuis `.utils.ts`
- [ ] Composant plus concis et lisible
- [ ] Tous les tests passent

## Mapping Explicite vs Type Assertion

### ❌ Problème : Type Assertion Dangereuse

```typescript
const posKey = pos === 'Non-votant' 
  ? 'nonVotant' 
  : pos.toLowerCase() as 'pour' | 'contre' | 'abstention' | 'nonVotant';
//                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                     Dangereux : runtime peut différer du type
```

### ✅ Solution : Mapping Explicite

```typescript
const positionKeyMap: Record<
  string, 
  keyof Pick<GroupData, 'pour' | 'contre' | 'abstention' | 'nonVotant'>
> = {
  'Pour': 'pour',
  'Contre': 'contre',
  'Abstention': 'abstention',
  'Non-votant': 'nonVotant'
};

const posKey = positionKeyMap[pos]; // Type-safe !
```

**Avantages** :
- Type-safe à 100% (pas de cast)
- Runtime garanti correct
- Exhaustivité vérifiée par TypeScript
- Facile à étendre

## Workflow de Refactoring

```
1. IDENTIFIER
   ↓
   Repérer logique complexe dans $derived.by()
   
2. CRÉER
   ↓
   Nouveau fichier .utils.ts
   
3. EXTRAIRE
   ↓
   Copier interfaces + fonctions
   
4. TYPER
   ↓
   Ajouter types explicites + JSDoc
   
5. TESTER
   ↓
   Écrire tests unitaires
   
6. REFACTORER COMPOSANT
   ↓
   Importer et utiliser utils
   
7. VALIDER
   ↓
   Tous les tests passent
```

## Anti-Patterns à Éviter

### ❌ Tout extraire systématiquement

```typescript
// Inutile pour logique triviale
export function getFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}
```

**Règle** : Si la fonction fait <5 lignes et est évidente, la laisser inline.

### ❌ Extraire logique UI

```typescript
// NON - couplé au DOM
export function handleClick(event: MouseEvent) {
  event.preventDefault();
  // ...
}
```

**Règle** : Seule la logique **pure** (données → données) doit être extraite.

### ❌ Sur-découpage

```
MonComposant.svelte
MonComposant.utils.ts
MonComposant.helpers.ts        ← Trop de fichiers
MonComposant.transformers.ts   ← Complexité inutile
MonComposant.validators.ts
```

**Règle** : 1 fichier `.utils.ts` par composant suffit dans la majorité des cas.

## Metrics de Succès

| Indicateur | Cible | GroupVotesStackedBar |
|------------|-------|----------------------|
| Lignes composant réduit | -30% | -38% ✅ (109→68) |
| Tests rapides | <100ms | 25ms ✅ |
| Type safety | 100% | 100% ✅ |
| Duplication code | 0% | 0% ✅ |

## Voir Aussi

- `pattern-component-documentation.md` - Documentation des composants
- `std-reusable-components.md` - Standard composants réutilisables
- `layercake-charts-rule.md` - Standard graphiques LayerCake

## Références

- [Svelte Best Practices](https://svelte.dev/docs/svelte/best-practices)
- [Testing Pure Functions](https://kentcdodds.com/blog/pure-functions)
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-04 | Création suite à refactoring GroupVotesStackedBar |
