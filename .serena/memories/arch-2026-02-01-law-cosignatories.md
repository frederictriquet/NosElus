# Architecture : Law Cosignatories (Phase 2.1 Option 3)

## Date : 2026-02-01

## Vue d'ensemble

Import des dossiers législatifs AN avec auteurs et cosignataires pour débloquer la phase 2.2.

```
┌─────────────────────────────────────────────────────────────────┐
│              AN OpenData (ZIP JSON)                              │
│  data.assemblee-nationale.fr/dossiers_legislatifs               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              ETL: import-dossiers-an.ts                          │
│  - Parse JSON files (dossierParlementaire/, document/)          │
│  - Extract authors from dossiers and documents                   │
│  - Match acteurs by identifiant AN                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Database                                            │
│  laws ◄──── law_cosignatories ────► actors                      │
│             (law_id, actor_id, role, signature_order)           │
└─────────────────────────────────────────────────────────────────┘
```

## Composants

| Fichier | Responsabilité |
|---------|----------------|
| `src/lib/server/db/schema/law-cosignatories.ts` | Schéma Drizzle de la table |
| `src/lib/server/etl/import-dossiers-an.ts` | ETL d'import |
| `scripts/etl/import-dossiers-an.ts` | Script CLI |

## Table law_cosignatories

```sql
CREATE TABLE law_cosignatories (
  law_id varchar(50) NOT NULL,
  actor_id varchar(20) NOT NULL,
  role varchar(30) NOT NULL,  -- 'author' | 'cosignatory' | 'rapporteur'
  signature_order integer,
  PRIMARY KEY (law_id, actor_id)
);
```

Index: `law_id`, `actor_id`, `role`
FK: `laws(id)`, `actors(id)`

## Données importées (2026-02-01)

- **2213 dossiers** législatifs
- **4684 cosignataires** (2699 auteurs + 1984 cosignataires)
- Source: `data.assemblee-nationale.fr` ZIP files

## Commande

```bash
make etl-dossiers-an
```

## Patterns réutilisés

- ETL pattern avec stats de progression
- Upsert via `onConflictDoUpdate`
- Batch insert (500 items)
