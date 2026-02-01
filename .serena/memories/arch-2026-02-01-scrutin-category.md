# Architecture - Classification sémantique des scrutins

## Date : 2026-02-01

## Vue d'ensemble

Ajout d'une colonne `category` (varchar 30) aux scrutins, classifiée automatiquement par analyse regex du titre.

## Composants

| Composant | Fichier | Responsabilité |
|-----------|---------|----------------|
| Schema | `src/lib/server/db/schema/scrutins.ts` | Définition colonne `category` |
| Classify | `src/lib/server/etl/classify.ts` | Fonction `classifyScrutin()` |
| Mapper | `src/lib/server/etl/sources/assemblee/mappers.ts` | Intégration à l'import |
| Helper | `src/lib/server/api/helpers.ts` | `getScrutinCategories()` dynamique |
| Route | `src/routes/an/scrutins/+page.server.ts` | Filtre category dans load() |
| UI | `src/routes/an/scrutins/+page.svelte` | Dropdown filtre catégorie |

## Taxonomie (6 catégories + fallback)

1. `vote-final` - Vote sur l'ensemble d'un texte
2. `article` - Vote sur un article spécifique
3. `amendement` - Vote sur un amendement
4. `procédure` - Motion, question de confiance
5. `budget` - Loi de finances, crédits
6. `constitutionnel` - Texte constitutionnel/organique
7. `autre` - Fallback

## Ordre de priorité des regex

procédure > constitutionnel > budget > vote-final > amendement > article > autre

## Fonction de classification

```typescript
// src/lib/server/etl/classify.ts
export function classifyScrutin(title: string): ScrutinCategory {
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(title)) {
      return rule.category;
    }
  }
  return 'autre';
}
```

## Helper dynamique (no-hardcoding)

```typescript
// src/lib/server/api/helpers.ts
export async function getScrutinCategories(whereClause?: SQL): Promise<ScrutinCategoryWithCount[]> {
  return db.select({ category, count: count() })
    .from(scrutins)
    .where(whereClause)
    .groupBy(category)
    .orderBy(desc(count()));
}
```

## Plan d'implémentation

1. Migration DB : colonne + index
2. ETL : classify.ts + mapScrutin modification
3. Reclassification : script pour 17881 scrutins existants
4. Helper : getScrutinCategories()
5. Routes : filtre category sur /an/scrutins, /pe/scrutins
6. UI : dropdown filtre + stats par catégorie
7. Tests : unitaires classify + intégration helper

## Patterns utilisés

- **Fonction pure** pour classification (testable, pas d'effets de bord)
- **SELECT DISTINCT** pour récupérer catégories (no-hardcoding)
- **Labels séparés** pour l'affichage UI (CATEGORY_LABELS)
- **Fallback safe** : retourne 'autre' si non classifiable
