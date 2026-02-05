# Pattern : Mapping LLM Tags Accentués → Slugs DB

## Problème

Les LLM génèrent naturellement des tags en français avec accents ("Économie", "Santé") mais les bases de données utilisent souvent des slugs ASCII comme clés primaires ("economie", "sante") pour éviter les problèmes d'encodage et de normalisation.

**Symptômes** :
- Le LLM retourne `["économie", "santé"]`
- La DB attend des slugs `["economie", "sante"]` pour les foreign keys
- Sans mapping, les tags ne sont pas reconnus et sont perdus

## Contexte

Ce pattern s'applique quand :
- ✅ Utilisation d'un LLM pour générer des catégories/tags en français
- ✅ Base de données avec slugs ASCII (sans accents) comme clés primaires
- ✅ Besoin de mapping bidirectionnel : LLM ↔ DB

## Solution

### Interface TagMapping

```typescript
/**
 * Mapping entre le nom affiché au LLM et le slug DB.
 */
export interface TagMapping {
  /** Slug ASCII utilisé comme clé primaire DB (ex: "economie") */
  slug: string;
  /** Nom affiché avec accents (ex: "Économie") */
  name: string;
  /** Nom lowercase pour le prompt LLM (ex: "économie") */
  promptName: string;
}
```

### Chargement dynamique depuis la DB

```typescript
/**
 * Charge les tags disponibles depuis la table `tags`.
 */
export async function getAvailableTags(): Promise<TagMapping[]> {
  const dbTags = await db
    .select({ slug: tags.slug, name: tags.name })
    .from(tags)
    .orderBy(asc(tags.name));

  return dbTags.map((t) => ({
    slug: t.slug,           // "economie"
    name: t.name,           // "Économie"
    promptName: t.name.toLowerCase()  // "économie"
  }));
}
```

### Utilisation dans le prompt LLM

```typescript
const tagMappings = await getAvailableTags();
const tagNames = tagMappings.map((t) => t.promptName);  // ["économie", "santé", ...]

const prompt = `
Tags disponibles : ${tagNames.join(', ')}

Choisis 2-4 tags parmi cette liste.
`;
```

### Parsing de la réponse LLM

```typescript
function parseResponse(rawText: string, tagMappings: TagMapping[]): { tags: string[] } {
  // Lookup: nom lowercase accentué → slug DB
  const nameToSlug = new Map(
    tagMappings.map((t) => [t.promptName, t.slug])
  );
  
  const data = JSON.parse(rawText);
  
  // Convertit les tags LLM (accentués) en slugs DB (ASCII)
  const validTags = (data.tags || [])
    .map((t: string) => nameToSlug.get(t.toLowerCase()))
    .filter((slug: string | undefined): slug is string => slug !== undefined);
    
  return { tags: validTags };  // ["economie", "sante"]
}
```

## Avantages

1. **Flexibilité** : Les tags peuvent être ajoutés/modifiés dans la DB sans changer le code
2. **Naturel pour le LLM** : Le LLM voit des noms français corrects avec accents
3. **Robustesse DB** : Les slugs ASCII évitent les problèmes d'encodage et de collation
4. **Type-safe** : Le mapping explicite évite les erreurs silencieuses
5. **Debuggable** : Facile de voir quels tags ont été reconnus ou rejetés

## Inconvénients

- Requiert une requête DB supplémentaire pour charger les mappings (mitigation : cache en mémoire ou passer les mappings en paramètre)
- Duplication partielle des données (slug vs name) — acceptable pour la clarté

## Exemples d'utilisation

### Dans NosElus

- `src/lib/server/etl/sources/llm/law-analyzer.ts:24` - `getAvailableTags()` et `TagMapping`
- `src/lib/server/etl/sources/llm/law-analyzer.ts:94` - `parseResponse()` avec conversion
- `src/lib/server/etl/sources/llm/law-analyzer.ts:150` - `analyzeLaw()` charge les mappings

### Schema DB

```sql
CREATE TABLE tags (
  slug VARCHAR(50) PRIMARY KEY,  -- "economie" (ASCII)
  name VARCHAR(100) NOT NULL,    -- "Économie" (avec accents)
  description TEXT,
  color VARCHAR(7)
);

CREATE TABLE law_tags (
  law_id VARCHAR(50) NOT NULL,
  tag_slug VARCHAR(50) NOT NULL,  -- Foreign key vers tags.slug
  PRIMARY KEY (law_id, tag_slug)
);
```

## Migration JSONB → Relational

Si vous migrez depuis un champ JSONB contenant des tags accentués :

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

INSERT INTO law_tags (law_id, tag_slug)
SELECT
  law_id,
  lower(unaccent(tag_value)) as tag_slug  -- "Économie" → "economie"
FROM law_summaries
CROSS JOIN LATERAL jsonb_array_elements_text(tags) AS tag_value
WHERE lower(unaccent(tag_value)) IN (SELECT slug FROM tags);
```

## Alternatives considérées

### Option A : Slugs accentués dans la DB
- **Avantages** : Pas de mapping nécessaire
- **Inconvénients** : Problèmes de collation (é = e ?), sensibilité aux encodages, complexité des comparaisons

### Option B : LLM génère directement des slugs ASCII
- **Avantages** : Pas de mapping post-parsing
- **Inconvénients** : Moins naturel pour le LLM, risque d'erreurs ("Economie" vs "economie"), perte de lisibilité

### Option C : Normalisation dynamique avec `unaccent`
- **Avantages** : Flexibilité maximale
- **Inconvénients** : Performance (appel `unaccent` à chaque requête), complexité des requêtes

**Choix retenu** : Mapping explicite (Option actuelle) pour la clarté et la maintenabilité.

## Voir aussi

- `pattern-component-documentation.md` - Documentation des interfaces TypeScript
- `adr-2026-02-02-law-full-text-retrieval.md` - Intégration LLM pour l'analyse de lois
- `std-french-utf8-content.md` - Standards d'encodage UTF-8 pour contenu français

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-05 | Création suite à implémentation filtrage tags lois |
