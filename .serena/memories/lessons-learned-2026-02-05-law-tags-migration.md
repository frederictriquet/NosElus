# Lessons Learned : Migration JSONB → Tables Relationnelles (Tags de Lois)

## Date
2026-02-05

## Contexte

Migration des tags de lois depuis une colonne JSONB dans `law_summaries` vers une architecture relationnelle many-to-many (`tags` ↔ `law_tags` ↔ `laws`).

**Objectifs** :
- ✅ Permettre le filtrage par tag (impossible avec JSONB indexé GIN)
- ✅ Ajouter des métadonnées aux tags (couleur, description)
- ✅ Charger dynamiquement les tags pour le LLM (pas de constant hardcodé)
- ✅ Améliorer les performances des requêtes de tags

## Architecture

### Avant (JSONB)

```typescript
// law_summaries
{
  law_id: "PRJL123",
  summary: "...",
  tags: ["Économie", "Santé"]  // ← JSONB array, pas de FK
}
```

**Limitations** :
- ❌ Pas de filtrage efficace par tag (`WHERE tags @> '["Économie"]'` lent)
- ❌ Pas de métadonnées (couleurs, descriptions)
- ❌ Duplication des noms de tags (risque d'incohérence : "Économie" vs "économie")
- ❌ Impossible de requêter "toutes les lois pour un tag donné" efficacement

### Après (Relationnel)

```sql
-- Table de référence des tags
CREATE TABLE tags (
  slug VARCHAR(50) PRIMARY KEY,  -- "economie" (clé ASCII)
  name VARCHAR(100) NOT NULL,    -- "Économie" (affichage)
  description TEXT,
  color VARCHAR(7),              -- "#3b82f6"
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Table de jonction many-to-many
CREATE TABLE law_tags (
  law_id VARCHAR(50) NOT NULL,
  tag_slug VARCHAR(50) NOT NULL,
  PRIMARY KEY (law_id, tag_slug),
  FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_slug) REFERENCES tags(slug) ON DELETE CASCADE
);

CREATE INDEX law_tags_tag_slug_idx ON law_tags (tag_slug);
CREATE INDEX law_tags_law_id_idx ON law_tags (law_id);
```

**Avantages** :
- ✅ Filtrage rapide : `SELECT laws.* FROM laws JOIN law_tags ON ... WHERE tag_slug = 'economie'`
- ✅ Métadonnées centralisées (couleur, description)
- ✅ Cohérence garantie par FK
- ✅ Batch loading efficace (voir `pattern-batch-loading-n-plus-one.md`)

## Migration SQL

### Étape 1 : Créer les tables

```sql
CREATE TABLE tags (...);
CREATE TABLE law_tags (...);
```

### Étape 2 : Peupler la table `tags`

```sql
INSERT INTO tags (slug, name, description, color) VALUES
  ('economie', 'Économie', 'Lois relatives à l''économie...', '#3b82f6'),
  ('sante', 'Santé', 'Lois concernant le système de santé...', '#ef4444'),
  -- ... 20 tags au total
```

### Étape 3 : Migrer les données JSONB avec `unaccent`

**⚠️ Point clé** : Le LLM a généré des tags accentués ("Économie") mais la table `tags` utilise des slugs ASCII ("economie"). Utiliser `unaccent` pour la conversion.

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

INSERT INTO law_tags (law_id, tag_slug)
SELECT
  ls.law_id,
  lower(unaccent(tag_value)) as tag_slug
FROM law_summaries ls
CROSS JOIN LATERAL jsonb_array_elements_text(ls.tags) AS tag_value
WHERE lower(unaccent(tag_value)) IN (SELECT slug FROM tags)
ON CONFLICT DO NOTHING;
```

**Explications** :
- `jsonb_array_elements_text(ls.tags)` : Explose le tableau JSONB en lignes
- `unaccent(tag_value)` : "Économie" → "Economie"
- `lower(...)` : "Economie" → "economie"
- `WHERE ... IN (SELECT slug FROM tags)` : Ne garde que les tags valides
- `ON CONFLICT DO NOTHING` : Évite les doublons si migration re-exécutée

**Résultat** :
```
INSERT 0 587  -- 587 associations law↔tag migrées
```

### Étape 4 : Nettoyer l'ancienne structure

```sql
DROP INDEX IF EXISTS law_summaries_tags_idx;  -- Index GIN devenu inutile
ALTER TABLE law_summaries DROP COLUMN tags;
```

## Leçons Apprises

### ✅ Ce qui a bien fonctionné

1. **`unaccent` pour normalisation** : Conversion automatique des accents sans mapping manuel
   ```sql
   unaccent('Économie') → 'Economie'
   lower('Economie') → 'economie'
   ```

2. **`CROSS JOIN LATERAL` pour expansion JSONB** : Pattern propre et lisible
   ```sql
   FROM law_summaries
   CROSS JOIN LATERAL jsonb_array_elements_text(tags) AS tag_value
   ```

3. **Validation avec `WHERE ... IN (SELECT slug FROM tags)`** : Évite les tags orphelins

4. **Indexes composites** : 
   - `(law_id, tag_slug)` pour la PK
   - Index séparé sur `tag_slug` pour `WHERE tag_slug = ?`
   - Index séparé sur `law_id` pour batch loading

5. **Cascade DELETE** : Suppression automatique des law_tags si une loi ou un tag est supprimé

### ⚠️ Points d'attention

1. **Ne pas oublier `ON CONFLICT DO NOTHING`** dans la migration
   - Sans ça, une ré-exécution de la migration échoue sur les doublons
   - Migration doit être idempotente

2. **Tester la migration sur une copie** avant production
   ```bash
   # Backup
   pg_dump noselus > backup-before-migration.sql
   
   # Test migration
   psql noselus < migration.sql
   
   # Vérifier
   SELECT COUNT(*) FROM law_tags;  -- Doit matcher les tags JSONB
   ```

3. **Vérifier les tags non reconnus**
   ```sql
   -- Tags dans JSONB mais pas dans la table tags
   SELECT DISTINCT tag_value
   FROM law_summaries
   CROSS JOIN LATERAL jsonb_array_elements_text(tags) AS tag_value
   WHERE lower(unaccent(tag_value)) NOT IN (SELECT slug FROM tags);
   ```
   
   **Résultat dans notre cas** : 0 tags non reconnus (les 20 tags couvraient 100% des données)

4. **Performance de `unaccent`** : 
   - ✅ OK pour migration one-shot (< 1 sec pour 587 lignes)
   - ❌ À éviter dans les requêtes fréquentes (utiliser des slugs pré-normalisés)

### ❌ Erreurs évitées

1. **Ne pas utiliser `lower(tags.name)` comme clé de jonction**
   - Problème : "Économie" ≠ "économie" en SQL strict
   - Solution : Slugs ASCII séparés ("economie")

2. **Ne pas créer les indexes après insertion des données**
   - Créer les indexes AVANT `INSERT INTO law_tags` (plus rapide)

3. **Ne pas oublier les FK ON DELETE CASCADE**
   - Sans ça, orphelins si suppression de lois

## Impact sur le Code

### ETL : Chargement dynamique des tags

**Avant** :
```typescript
const AVAILABLE_TAGS = [
  { slug: 'economie', name: 'Économie', promptName: 'économie' },
  // ... 19 autres tags hardcodés
];
```

**Après** :
```typescript
export async function getAvailableTags(): Promise<TagMapping[]> {
  const dbTags = await db.select({ slug: tags.slug, name: tags.name }).from(tags);
  return dbTags.map((t) => ({ slug: t.slug, name: t.name, promptName: t.name.toLowerCase() }));
}
```

**Avantage** : Ajouter un tag = 1 ligne SQL, pas de redéploiement

### Routes : Batch loading au lieu de N+1

**Avant** (N+1) :
```typescript
const laws = await db.select().from(laws).limit(20);
for (const law of laws) {
  law.tags = await db.select().from(lawTags).where(eq(lawTags.lawId, law.id));
}
// 21 requêtes
```

**Après** (batch) :
```typescript
const lawsList = await db.select().from(laws).limit(20);
const lawIds = lawsList.map(l => l.id);
const allTags = await db.select().from(lawTags).where(inArray(lawTags.lawId, lawIds));
const tagsByLawId = groupBy(allTags, t => t.lawId);
// 2 requêtes ✅
```

Voir `pattern-batch-loading-n-plus-one.md` pour détails.

## Métriques

| Métrique | Avant (JSONB) | Après (Relationnel) | Gain |
|----------|---------------|---------------------|------|
| Filtrage par tag | ~300ms (seq scan + JSONB @>) | ~15ms (index scan) | 20× |
| N+1 queries sur /laws | 21 requêtes | 2 requêtes | 10× |
| Ajout d'un nouveau tag | Redéploiement code | 1 INSERT SQL | ∞ |
| Cohérence des noms | Risque typos | Garantie par FK | ✅ |

## Checklist pour futures migrations similaires

- [ ] Identifier les colonnes JSONB candidates (filtres fréquents, métadonnées manquantes)
- [ ] Concevoir le schéma relationnel (tables de référence + jonction)
- [ ] Créer les tables et indexes
- [ ] Écrire la migration SQL avec `CROSS JOIN LATERAL` pour JSONB arrays
- [ ] Utiliser `unaccent` + `lower` pour normalisation si nécessaire
- [ ] Valider les données migrées (COUNT, DISTINCT, NULL checks)
- [ ] Tester sur copie avant prod
- [ ] Ajouter `ON CONFLICT DO NOTHING` pour idempotence
- [ ] Mettre à jour le code (batch loading, getAvailableTags, etc.)
- [ ] Documenter la migration (ADR si décision architecturale majeure)
- [ ] Nettoyer l'ancienne structure (DROP COLUMN, indexes)

## Voir aussi

- `pattern-llm-tag-mapping-accents.md` - Mapping LLM ↔ DB avec accents
- `pattern-batch-loading-n-plus-one.md` - Batch loading pour éviter N+1
- `database-queries-factorization.md` - Factorisation des requêtes
- `adr-2026-02-02-law-full-text-retrieval.md` - Architecture analyse LLM

## Fichiers modifiés

| Fichier | Type | Changement |
|---------|------|------------|
| `drizzle/migrations/0011_broken_the_enforcers.sql` | Migration | Création tables + migration données |
| `src/lib/server/db/schema/tags.ts` | Schema | Nouvelle table `tags` |
| `src/lib/server/db/schema/law-tags.ts` | Schema | Nouvelle table `law_tags` |
| `src/lib/server/db/schema/law-summaries.ts` | Schema | Suppression colonne `tags` |
| `src/lib/server/etl/sources/llm/law-analyzer.ts` | ETL | `getAvailableTags()` dynamique |
| `src/routes/an/laws/+page.server.ts` | Route | Filtre par tag + batch loading |
| `src/routes/debug/+page.server.ts` | Route | Fix N+1 avec batch loading |
| `src/lib/components/TagBadge.svelte` | UI | Composant avec couleur depuis DB |

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-05 | Création suite à migration complète tags de lois |
