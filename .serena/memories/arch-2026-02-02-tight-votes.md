# Architecture : Votes Serrés (Phase 4.2)

## Date : 2026-02-02

## Vue d'ensemble

Fonctionnalité identifiant les scrutins "serrés" (marge ≤ 10 voix) et affichant cette information sur les pages scrutins, députés et une page dédiée.

## Composants

| Composant | Fichier | Responsabilité |
|-----------|---------|----------------|
| Schema | `src/lib/server/db/schema/scrutins.ts` | Colonne margin + index |
| Migration | `drizzle/migrations/0007_*.sql` | ALTER TABLE + UPDATE |
| Helpers | `src/lib/server/api/helpers.ts` | getTightScrutins, getActorTightVoteStats |
| Route Liste | `src/routes/an/scrutins/serres/+page.server.ts` | Page dédiée |
| Route Scrutin | `src/routes/an/scrutins/[id]/+page.svelte` | Badge tight-vote |
| Route Député | `src/routes/an/deputes/[id]/+page.svelte` | Panel AsyncCard |

## Interfaces principales

```typescript
interface TightScrutin {
  id: string;
  number: number;
  date: string;
  title: string;
  category: string | null;
  margin: number;
  isTie: boolean;
}

interface ActorTightVoteStats {
  totalTightVotes: number;
  winningVotes: number;
  losingVotes: number;
  tieVotes: number;
  recentTightVotes: TightVoteDetail[];
}

interface TightVoteDetail {
  scrutinId: string;
  scrutinTitle: string;
  margin: number;
  actorPosition: VotePosition;
  wasWinning: boolean | null;
}
```

## Constantes

```typescript
const TIGHT_VOTE_THRESHOLDS = [5, 10, 20] as const;
const DEFAULT_TIGHT_THRESHOLD = 10;
```

## Helpers signatures

```typescript
getTightScrutins(threshold?, whereClause?, limit?, offset?): Promise<TightScrutin[]>
countTightScrutins(threshold?, whereClause?): Promise<number>
getActorTightVoteStats(actorId, threshold?, whereClause?, recentLimit?): Promise<ActorTightVoteStats>
getPivotGroups(scrutinId): Promise<PivotGroup[]>  // Phase 2
```

## Wording UI

- Badge : "Égalité parfaite" (margin=0) | "Très serré" (≤5) | "Serré" (≤10) | "Assez serré" (≤20)
- Panel : "Votes serrés"
- Tooltip : "Marge de X voix"

## Index DB

- `scrutins_margin_idx` (NOUVEL INDEX)
- Réutilise `scrutins_legislature_idx`, `scrutins_category_idx`

## Pattern réutilisés

- AsyncCard pour streaming (ui-best-practices)
- Pattern helpers factorisés (database-queries-factorization)
- Pattern migration Drizzle (0006 comme modèle)
- Pattern ADR (adr-2026-02-01-scrutin-category comme modèle)

## Plan d'implémentation

1. Migration DB (schema + migration 0007)
2. Helpers (types + 4 fonctions)
3. Routes (serres/ + modifications [id])
4. UI (badge + panel AsyncCard)
5. Tests intégration
6. CSS + navigation

## Fichiers

**À créer** : 3
- drizzle/migrations/0007_*.sql
- src/routes/an/scrutins/serres/+page.server.ts
- src/routes/an/scrutins/serres/+page.svelte

**À modifier** : 9
- src/lib/server/db/schema/scrutins.ts
- src/lib/server/api/helpers.ts
- src/routes/an/scrutins/[id]/+page.server.ts
- src/routes/an/scrutins/[id]/+page.svelte
- src/routes/an/deputes/[id]/+page.server.ts
- src/routes/an/deputes/[id]/+page.svelte
- src/app.css
- src/lib/components/Navigation.svelte
- src/lib/server/api/helpers.test.ts

## Liens

- ADR : `adr-2026-02-02-decisive-votes.md`
- Exploration : `exploration-decisive-votes-2026-02-02.md`
- Pattern similaire : `arch-2026-02-01-dissidence-metrics.md`
