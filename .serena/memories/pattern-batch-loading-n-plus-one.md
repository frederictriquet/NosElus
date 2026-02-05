# Pattern : Batch Loading pour Éviter N+1 Queries

## Problème

Lors de l'affichage d'une liste d'entités avec leurs relations (ex: lois avec leurs tags, députés avec leurs groupes), une approche naïve génère **1 requête pour la liste + N requêtes pour chaque relation** (N+1 queries).

**Symptômes** :
- Temps de chargement lent (proportionnel au nombre d'entités)
- Log de requêtes DB montrant des centaines de SELECT identiques
- Performance dégradée avec pagination (chaque page = N nouvelles requêtes)

**Exemple N+1** :
```typescript
// 1 requête : charger 20 lois
const laws = await db.select().from(laws).limit(20);

// 20 requêtes : charger les tags de chaque loi
const lawsWithTags = await Promise.all(
  laws.map(async (law) => ({
    ...law,
    tags: await db.select().from(lawTags).where(eq(lawTags.lawId, law.id))
  }))
);
// Total: 21 requêtes au lieu de 2 !
```

## Contexte

Ce pattern s'applique quand :
- ✅ Affichage d'une liste d'entités avec leurs relations (many-to-many, one-to-many)
- ✅ La relation peut être chargée en batch (pas de logique conditionnelle complexe)
- ✅ Le nombre d'entités est variable (pagination, filtres)

## Solution

### Pattern en 3 étapes

1. **Charger les entités parentes**
2. **Charger toutes les relations en une seule requête avec `inArray`**
3. **Grouper côté application** avec une Map ou un dictionnaire

### Code complet

```typescript
// Étape 1 : Charger les lois (entités parentes)
const lawsList = await db
  .select({ id: laws.id, title: laws.title, /* ... */ })
  .from(laws)
  .where(whereClause)
  .limit(20)
  .offset(offset);

// Étape 2 : Batch load des tags (une seule requête)
const lawIds = lawsList.map((l) => l.id);
const lawTagsData = lawIds.length > 0
  ? await db
      .select({
        lawId: lawTags.lawId,
        slug: tags.slug,
        name: tags.name,
        color: tags.color
      })
      .from(lawTags)
      .innerJoin(tags, eq(lawTags.tagSlug, tags.slug))
      .where(inArray(lawTags.lawId, lawIds))  // ← Clé : charge TOUS les tags en 1 requête
  : [];

// Étape 3 : Grouper par lawId côté application
const tagsByLawId = new Map<string, TagData[]>();
for (const row of lawTagsData) {
  if (!tagsByLawId.has(row.lawId)) {
    tagsByLawId.set(row.lawId, []);
  }
  tagsByLawId.get(row.lawId)!.push({
    slug: row.slug,
    name: row.name,
    color: row.color
  });
}

// Étape 4 : Fusionner les données
const lawsWithTags = lawsList.map((law) => ({
  ...law,
  tags: tagsByLawId.get(law.id) ?? []  // Valeur par défaut si aucun tag
}));

// Résultat : 2 requêtes au lieu de 21 !
```

## Avantages

1. **Performance** : O(1) requêtes au lieu de O(N) — dramatique pour N > 50
2. **Scalabilité** : Temps constant quelle que soit la taille de la liste
3. **Simplicité** : Pas besoin d'ORM complexe ou de DataLoader
4. **Contrôle** : Flexibilité totale sur les données chargées (SELECT partiel)
5. **Debuggable** : Facile de logger les 2 requêtes pour vérifier

## Inconvénients

- Légèrement plus de code que l'approche naïve
- Nécessite une Map/dictionnaire temporaire en mémoire (négligeable pour < 1000 entités)
- Ordre des tags non garanti (doit être trié côté application si nécessaire)

## Exemples d'utilisation dans NosElus

| Fichier | Relation | Gain |
|---------|----------|------|
| `src/routes/an/laws/+page.server.ts:94` | Laws → Tags | 21 req → 2 req (20 lois) |
| `src/routes/debug/+page.server.ts:31` | Laws → Tags | 101 req → 2 req (100 lois) |
| `src/routes/an/groupes/+page.server.ts` | Groups → Members | ~15 req → 2 req (groupes AN) |

### Exemple réel : Route `/an/laws`

Avant (N+1) :
```typescript
// 1 requête pour 20 lois
const laws = await db.select().from(laws).limit(20);

// 20 requêtes pour les tags
for (const law of laws) {
  law.tags = await db.select().from(lawTags).where(eq(lawTags.lawId, law.id));
}
// Total: 21 requêtes
```

Après (batch loading) :
```typescript
// 1 requête pour 20 lois
const lawsList = await db.select().from(laws).limit(20);

// 1 requête pour TOUS les tags des 20 lois
const lawIds = lawsList.map(l => l.id);
const allTags = await db
  .select()
  .from(lawTags)
  .where(inArray(lawTags.lawId, lawIds));

// Grouper en mémoire
const tagsByLawId = groupBy(allTags, t => t.lawId);
const lawsWithTags = lawsList.map(l => ({ ...l, tags: tagsByLawId[l.id] ?? [] }));
// Total: 2 requêtes ✅
```

## Variantes

### Variante 1 : Avec LEFT JOIN (si chaque parent a exactement 1 relation)

```typescript
// Pour une relation 1:1 ou N:1 (ex: law → latestAmendment)
const lawsWithAmendment = await db
  .select({
    lawId: laws.id,
    lawTitle: laws.title,
    amendmentId: amendments.id,
    amendmentText: amendments.text
  })
  .from(laws)
  .leftJoin(amendments, eq(laws.latestAmendmentId, amendments.id))
  .limit(20);
// 1 seule requête, mais duplication si 1:N
```

**Attention** : Ne pas utiliser LEFT JOIN pour many-to-many (explosion du nombre de lignes).

### Variante 2 : Avec Drizzle `with` (relations)

```typescript
// Si schéma Drizzle définit les relations
const lawsWithTags = await db.query.laws.findMany({
  limit: 20,
  with: { tags: true }
});
// Drizzle fait le batch loading automatiquement (2 requêtes en interne)
```

**Préférer le batch loading manuel** pour :
- Contrôle fin des colonnes chargées
- Transparence des requêtes SQL générées
- Compatibilité avec tous les ORM/query builders

## Checklist

Avant d'implémenter batch loading :
- [ ] Identifier la relation N:1 ou N:M causant le N+1
- [ ] Vérifier que la relation peut être chargée sans logique conditionnelle
- [ ] Extraire les IDs des entités parentes (`lawIds = laws.map(l => l.id)`)
- [ ] Utiliser `inArray(childTable.parentId, parentIds)` dans la requête batch
- [ ] Grouper avec `Map<ParentId, Child[]>` côté application
- [ ] Fusionner avec valeur par défaut (`?? []`) pour les parents sans enfants

## Debugging

### Vérifier le nombre de requêtes

```typescript
// Avant batch loading
console.time('loadLaws');
const laws = await loadLawsWithTagsNaive();
console.timeEnd('loadLaws');
// => loadLaws: 850ms (21 requêtes)

// Après batch loading
console.time('loadLaws');
const laws = await loadLawsWithTagsBatch();
console.timeEnd('loadLaws');
// => loadLaws: 45ms (2 requêtes) ✅
```

### Logger les requêtes SQL

```typescript
// drizzle.config.ts
export default {
  logger: true  // Active le logging SQL
};

// Résultat dans la console :
// Query: SELECT * FROM laws LIMIT 20 OFFSET 0
// Query: SELECT * FROM law_tags WHERE law_id IN ($1, $2, ..., $20)
```

## Voir aussi

- `database-queries-factorization.md` - Factorisation des requêtes répétées
- `pattern-integration-tests-real-db.md` - Tests de performance des requêtes
- [Dataloader pattern](https://github.com/graphql/dataloader) - Pattern similaire pour GraphQL

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-05 | Création suite à fix N+1 sur page debug et laws |
