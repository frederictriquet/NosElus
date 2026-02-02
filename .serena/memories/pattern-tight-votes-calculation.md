# Pattern : Calcul des Votes Serrés

## Catégorie
Data Model / Performance

## Date d'adoption
2026-02-02

## Problème
Identifier efficacement les scrutins où le résultat était serré (marge de victoire faible).

## Solution

### 1. Colonne pré-calculée
```typescript
// Dans le schéma Drizzle
margin: integer('margin').notNull().default(0),
```

### 2. Index dédié
```typescript
index('scrutins_margin_idx').on(table.margin)
```

### 3. Migration de calcul initial
```sql
UPDATE "scrutins" SET "margin" = ABS("total_for" - "total_against");
```

### 4. Maintien à l'insertion/update
Le script ETL doit calculer `margin` lors de l'import des scrutins :
```typescript
margin: Math.abs(totalFor - totalAgainst)
```

## Seuils définis

```typescript
export const TIGHT_VOTE_THRESHOLDS = [5, 10, 20] as const;
export type TightVoteThreshold = (typeof TIGHT_VOTE_THRESHOLDS)[number];
export const DEFAULT_TIGHT_THRESHOLD: TightVoteThreshold = 10;

export const TIGHT_THRESHOLD_LABELS: Record<TightVoteThreshold, string> = {
    5: '≤ 5 voix (très serré)',
    10: '≤ 10 voix (serré)',
    20: '≤ 20 voix (assez serré)'
};
```

## Labels d'affichage

```typescript
export function getTightLabel(margin: number): string | null {
    if (margin === 0) return 'Égalité parfaite';
    if (margin <= 5) return 'Très serré';
    if (margin <= 10) return 'Serré';
    if (margin <= 20) return 'Assez serré';
    return null;
}
```

## Helpers disponibles

### `getTightScrutins(threshold, whereClause?, limit?, offset?)`
Liste paginée des scrutins serrés.

### `countTightScrutins(threshold, whereClause?)`
Comptage total pour pagination.

### `getActorTightVoteStats(actorId, threshold, whereClause?, recentLimit?)`
Statistiques d'un député sur les votes serrés :
- Total de participations
- Votes gagnants / perdants / égalités
- Liste des votes récents

## Usage côté route

```typescript
// +page.server.ts
import { getTightScrutins, countTightScrutins, DEFAULT_TIGHT_THRESHOLD } from '$lib/server/api/helpers';

const [scrutins, total] = await Promise.all([
    getTightScrutins(threshold, whereClause, limit, offset),
    countTightScrutins(threshold, whereClause)
]);
```

## Avantages

1. **Performance** : Requêtes O(log n) grâce à l'index
2. **Simplicité** : Pas de calcul complexe à chaque requête
3. **Cohérence** : Valeur unique calculée une fois
4. **Filtrage combiné** : Compatible avec autres filtres (legislature, category)

## Limitations

- Nécessite migration initiale pour calculer les valeurs existantes
- Le script ETL doit maintenir la valeur à jour

## Voir aussi
- `adr-2026-02-02-decisive-votes.md` - Décision technique complète
- `lessons-learned-2026-02-02-tight-votes.md` - Retour d'expérience
