# Pattern : Migrations Idempotentes (Drizzle ORM)

## Règle

Toute migration SQL générée par Drizzle doit être idempotente avant d'être committée.

## Workflow

```
npm run db:generate
  → drizzle-kit generate (SQL non-idempotent)
  → scripts/make-idempotent.js (transformations automatiques)
  → Review manuelle obligatoire
  → Commit
```

## Transformations Automatiques (Script)

Le script `scripts/make-idempotent.js` transforme automatiquement :

| Avant | Après |
|-------|-------|
| `CREATE TABLE "x"` | `CREATE TABLE IF NOT EXISTS "x"` |
| `CREATE INDEX "x"` | `CREATE INDEX IF NOT EXISTS "x"` |
| `CREATE UNIQUE INDEX "x"` | `CREATE UNIQUE INDEX IF NOT EXISTS "x"` |
| `ALTER TABLE "x" ADD COLUMN "y"` | `ALTER TABLE "x" ADD COLUMN IF NOT EXISTS "y"` |
| `DROP TABLE "x"` | `DROP TABLE IF EXISTS "x"` |
| `DROP INDEX "x"` | `DROP INDEX IF EXISTS "x"` |
| `ALTER TABLE "x" DROP COLUMN "y"` | `ALTER TABLE "x" DROP COLUMN IF EXISTS "y"` |

## Cas Manuels (Nécessitent Intervention)

### ADD CONSTRAINT (pas de IF NOT EXISTS natif)

```sql
-- ❌ Généré par Drizzle (non idempotent)
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");

-- ✅ Version idempotente (PL/pgSQL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_org_id_fk'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fk"
      FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");
  END IF;
END $$;
```

### INSERT (ajouter ON CONFLICT)

```sql
-- ❌ Non idempotent
INSERT INTO "tags" ("slug", "name") VALUES ('eco', 'Économie');

-- ✅ Idempotent
INSERT INTO "tags" ("slug", "name") VALUES ('eco', 'Économie')
ON CONFLICT (slug) DO NOTHING;

-- ✅ Idempotent avec mise à jour
INSERT INTO "tags" ("slug", "name") VALUES ('eco', 'Économie')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;
```

### CREATE EXTENSION

```sql
-- ✅ Déjà idempotent par défaut
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### ALTER COLUMN (type, default, NOT NULL)

```sql
-- Ces opérations sont naturellement idempotentes
-- (appliquer deux fois le même changement ne cause pas d'erreur)
ALTER TABLE "users" ALTER COLUMN "name" SET DATA TYPE text;
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "name" SET DEFAULT 'unknown';
```

## Checklist Code Review

Lors de la review d'une migration, vérifier :

- [ ] Tous les `CREATE TABLE` ont `IF NOT EXISTS`
- [ ] Tous les `CREATE INDEX` ont `IF NOT EXISTS`
- [ ] Tous les `ADD COLUMN` ont `IF NOT EXISTS`
- [ ] Tous les `DROP` ont `IF EXISTS`
- [ ] Tous les `ADD CONSTRAINT` utilisent le wrapper PL/pgSQL
- [ ] Tous les `INSERT` ont `ON CONFLICT DO NOTHING` (ou `DO UPDATE`)
- [ ] Les `ALTER COLUMN` sont naturellement idempotents (OK par défaut)

## Migrations Existantes

Les migrations 0000 à 0011 ne sont **PAS** modifiées (déjà appliquées en prod).
Ce standard s'applique uniquement aux migrations **0012+**.

## ADR de Référence

Voir `adr-2026-02-06-idempotent-migrations.md` (ADR-005)

## Date de Création
2026-02-06
