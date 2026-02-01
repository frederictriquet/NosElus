# Architecture - Métriques d'Autonomie de Vote (Phase 1.2)

## Date : 2026-02-01

## Vue d'ensemble

Ajout de métriques d'autonomie de vote pour mesurer la divergence des députés par rapport à leur groupe parlementaire.

## Composants

| Composant | Fichier | Responsabilité |
|-----------|---------|----------------|
| Types + Cache | `src/lib/server/utils/dissidence.ts` | Logique métier pure |
| Helpers | `src/lib/server/api/helpers.ts` | Fonctions partagées |
| Route Député | `src/routes/an/deputes/[id]/+page.server.ts` | Load autonomyStats |
| Route Groupe | `src/routes/an/groupes/[id]/+page.server.ts` | Load divisiveVotes |
| UI Député | `src/routes/an/deputes/[id]/+page.svelte` | Panel "Autonomie de vote" |
| UI Groupe | `src/routes/an/groupes/[id]/+page.svelte` | Section votes divisifs |

## Interfaces principales

```typescript
interface AutonomyStats {
  divergenceRate: number;      // 0-100%
  divergentVotes: number;
  totalComparableVotes: number;
  byCategory: AutonomyByCategory[];
}

interface DivisiveVote {
  scrutinId: string;
  scrutinTitle: string;
  minorityRate: number;        // 0-50%, plus haut = plus divisif
  distribution: { pour, contre, abstention, total };
  majorityPosition: 'pour' | 'contre' | 'abstention';
}
```

## Constantes

```typescript
const AUTONOMY_THRESHOLD = 15;     // Seuil badge "Vote autonome"
const MIN_VOTES_FOR_STATS = 10;    // Min votes pour afficher stats
const CACHE_DURATION = 60 * 60 * 1000; // 1h
```

## Pattern de cache

Réutilise le pattern établi dans `an-legislatures.ts` :
- Cache in-memory avec Map
- TTL 1 heure
- Clé composite : `actorId_groupId_legislature`
- Lazy loading (pas de pré-population)

## Wording UI

- Panel : "Autonomie de vote"
- Métrique : "Taux de divergence avec le groupe"
- Badge : "Vote autonome" (si > 15%)
- Tooltip : "% de votes où le député diffère de la majorité de son groupe"

## Index DB utilisés

- `votes_group_id_idx` ✅
- `votes_scrutin_actor_idx` ✅
- `scrutins_category_idx` ✅

## Métriques

**Autonomie député** = (votes divergents / votes comparables) × 100
**Vote divisif** = minorityRate = (min(pour, contre, abst) / total) × 100

## Plan d'implémentation

1. Créer `dissidence.ts` (types + cache + logique)
2. Ajouter helpers dans `helpers.ts`
3. Modifier routes serveur
4. Ajouter UI (AsyncCard pattern)
5. Tests unitaires + EXPLAIN ANALYZE

## Liens avec autres fonctionnalités

- **Phase 1.1** : Utilise `scrutins.category` pour breakdown
- **Cohésion groupe** : Pattern similaire dans `cohesion.ts`
- **Alignment existant** : `loadGroupAlignment()` dans page député (à enrichir)
