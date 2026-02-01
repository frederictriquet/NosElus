# Architecture - Phase 2.2 : Implication individuelle par texte

## Date : 2026-02-01

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLICATION PAR TEXTE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐     ┌─────────────┐     ┌──────────────┐       │
│  │   laws     │────▶│ Implication │◀────│   actors     │       │
│  │ (dossiers) │     │   Engine    │     │   (élus)     │       │
│  └────────────┘     └──────┬──────┘     └──────────────┘       │
│        │                   │                   │                │
│        │            ┌──────┴──────┐            │                │
│        │            ▼             ▼            │                │
│        │     ┌───────────┐ ┌───────────┐      │                │
│        │     │cosignatures│ │amendments │      │                │
│        │     │  (NEW)    │ │(existant) │      │                │
│        └────▶└───────────┘ └───────────┘◀─────┘                │
│                     │             │                             │
│                     ▼             ▼                             │
│              ┌─────────────────────────┐                       │
│              │       scrutins          │                       │
│              │   (votes existants)     │                       │
│              └─────────────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## État des données (2026-02-01)

| Table | Total | Liés à dossier | Status |
|-------|-------|----------------|--------|
| laws | 12 164 | - | ⚠️ Sénat uniquement, 0 AN |
| amendments | 35 | 0 | ❌ lawId non renseigné |
| scrutins | 17 881 | 0 | ❌ lawId non renseigné |
| cosignatures | - | - | ❌ Table inexistante |

## Dépendances bloquantes

**Phase 2.1** doit être complétée AVANT Phase 2.2 :
1. ❌ Exécuter `make etl-laws` pour importer les dossiers AN
2. ❌ Lier scrutins aux dossiers (`linkScrutinsToLaws()`)
3. ❌ Importer les amendements avec leurs lawId

## Schéma de données

### Table existante : amendments
```typescript
amendments = pgTable('amendments', {
  id: varchar('id', { length: 50 }).primaryKey(),
  lawId: varchar('law_id', { length: 50 }).references(() => laws.id),
  authorId: varchar('author_id', { length: 20 }).references(() => actors.id),
  // ... autres champs existants
});
```

### Nouvelle table : law_cosignatories
```typescript
lawCosignatories = pgTable('law_cosignatories', {
  lawId: varchar('law_id', { length: 50 }).references(() => laws.id).notNull(),
  actorId: varchar('actor_id', { length: 20 }).references(() => actors.id).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'author' | 'cosignatory'
  signatureOrder: integer('signature_order'),
}, (table) => [
  primaryKey({ columns: [table.lawId, table.actorId] }),
  index('law_cosignatories_law_idx').on(table.lawId),
  index('law_cosignatories_actor_idx').on(table.actorId),
]);
```

## Interface d'agrégation

```typescript
interface ActorImplication {
  actorId: string;
  lawId: string;
  
  // Contribution directe
  isAuthor: boolean;
  isCosignatory: boolean;
  
  // Amendements
  amendmentsDeposed: number;
  amendmentsAdopted: number;
  amendmentsRejected: number;
  
  // Votes
  votesCast: number;
  votedFor: number;
  votedAgainst: number;
  votedAbstention: number;
  
  // Score d'implication (calculé)
  implicationScore: number; // 0-100
}

interface LawImplication {
  lawId: string;
  
  // Contributeurs
  authors: ActorSummary[];
  cosignatories: ActorSummary[];
  
  // Amendements
  totalAmendments: number;
  topAmendmentAuthors: { actor: ActorSummary; count: number }[];
  
  // Scrutins
  totalScrutins: number;
  scrutinsByCategory: { category: string; count: number }[];
}
```

## Fichiers à créer

```
src/
├── lib/server/
│   ├── db/schema/
│   │   └── law-cosignatories.ts    # Nouvelle table
│   ├── api/
│   │   └── implication.ts          # Helpers d'agrégation
│   └── etl/sources/assemblee/
│       └── cosignatories.ts        # ETL cosignatures
│
├── routes/an/
│   ├── laws/[id]/
│   │   └── +page.svelte            # Ajouter section implication
│   └── deputes/[id]/
│       └── +page.svelte            # Ajouter section implication
```

## Plan d'implémentation

### Phase 1 : Compléter Phase 2.1 (BLOQUANT)
1. Exécuter ETL dossiers AN (`make etl-laws`)
2. Lier scrutins aux dossiers
3. Vérifier données en base

### Phase 2 : Schema cosignatures
1. Créer table `law_cosignatories`
2. Migration Drizzle
3. ETL import cosignatures

### Phase 3 : Helpers d'agrégation
1. `getActorImplication(actorId, lawId)`
2. `getLawImplication(lawId)`
3. `getActorOverallImplication(actorId, filters)`

### Phase 4 : UI
1. Section implication sur page député
2. Section contributeurs sur page dossier législatif

## Recommandation

**BLOQUER Phase 2.2** jusqu'à ce que Phase 2.1 soit fonctionnelle avec données.

Actions immédiates :
1. Configurer ETL_DATA_DIR
2. Cloner dépôt Tricoteuses si pas fait
3. Exécuter `make etl-laws`
4. Vérifier que lawId est renseigné sur scrutins
