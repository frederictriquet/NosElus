# Dashboard Qualité des Données

Page publique affichant la qualité et la complétude des données de NosElus.

📍 **Route** : `/stats/data-quality`

## Vue d'ensemble

Le dashboard présente 3 sections de statistiques :

1. **KPI Globaux** (6 cartes) : Vue d'ensemble de la base de données
2. **Couverture des Élus** : Statistiques par chambre (AN, PE, SENAT)
3. **Couverture par Mandature** : Tableau interactif avec tri

## Architecture

### SvelteKit Streaming

Le loader serveur retourne des **promises non résolues** pour un affichage progressif :

```typescript
// ✅ Correct : promise non résolue
return {
	globalStats: loadGlobalStats(), // Pas de await !
	legislatureStats: loadLegislatureStats(),
	chamberStats: loadChamberStats()
};
```

**Avantages** :

- TTFB quasi-instantané (~170ms)
- Chaque panel charge indépendamment
- UX perçue améliorée (skeleton au lieu d'écran blanc)

### Composant AsyncCard

Chaque section utilise `AsyncCard.svelte` pour gérer le streaming :

```svelte
<AsyncCard title="Vue d'ensemble" promise={data.globalStats}>
	{#snippet children(stats)}
		<!-- Contenu affiché une fois la promise résolue -->
	{/snippet}
</AsyncCard>
```

États gérés automatiquement :

- ⏳ Loading : affiche un skeleton/spinner
- ✅ Success : affiche le contenu
- ❌ Error : affiche un message d'erreur

## Optimisations SQL

### Pattern CTE (Common Table Expressions)

Les requêtes utilisent des CTEs pour éviter le problème N+1 :

```sql
WITH law_stats AS (
  SELECT legislature,
    COUNT(*) as total_laws,
    COUNT(*) FILTER (WHERE EXISTS (...)) as laws_with_votes,
    ...
  FROM laws l
  GROUP BY l.legislature
),
scrutin_stats AS (
  SELECT legislature, COUNT(*) as total_scrutins
  FROM scrutins
  GROUP BY legislature
)
SELECT ls.*, COALESCE(ss.total_scrutins, 0)
FROM law_stats ls
LEFT JOIN scrutin_stats ss ON ls.legislature = ss.legislature
```

**Performance** : 1 requête au lieu de N (où N = nombre de législatures).

### COUNT(\*) FILTER (WHERE ...)

Agrège plusieurs métriques en 1 requête :

```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE has_votes) as with_votes,
  COUNT(*) FILTER (WHERE has_tags) as with_tags,
  ...
```

Alternative rejetée : 5 requêtes COUNT distinctes.

## Tri Interactif

### Tri Naturel des Législatures

Problème : tri lexicographique de "1", "10", "17" donne → 1, 10, 17, 2

Solution : `extractLegislatureNumber()` extrait le numéro pour tri naturel → 1, 2, 10, 17

```typescript
extractLegislatureNumber('17'); // → 17
extractLegislatureNumber('PE-10'); // → 10
extractLegislatureNumber('SE-2023'); // → 2023
```

### Configuration Déclarative

Les colonnes sont définies dans `COLUMNS` pour éviter la duplication :

```typescript
export const COLUMNS: ColumnConfig[] = [
	{
		key: 'legislature',
		label: 'Mandature',
		align: 'left',
		getValue: (row) => extractLegislatureNumber(row.legislature)
	},
	{
		key: 'totalLaws',
		label: 'Lois',
		align: 'right',
		getValue: (row) => row.totalLaws
	}
	// ... 5 autres colonnes
];
```

Rendu générique côté template :

```svelte
{#each COLUMNS as col}
	<th onclick={() => handleSort(col.key)}>
		{col.label}
	</th>
{/each}
```

### Accessibilité

Le tri respecte les standards WAI-ARIA :

- `aria-sort="ascending|descending|none"` sur chaque `<th>`
- `tabindex="0"` pour navigation clavier
- `onkeydown` pour activation Enter/Space
- Indicateur visuel ▲/▼ avec rotation CSS

## Fichiers

```
src/routes/stats/data-quality/
├── +page.server.ts          # Loader serveur (SQL, streaming)
├── +page.svelte             # UI (3 sections, tri, filtres)
├── page.helpers.ts          # Tri, formatage, classification
├── page.helpers.test.ts     # Tests unitaires (42 tests)
├── +page.server.test.ts     # Tests intégration (12 tests)
└── README.md                # Cette documentation
```

## Tests

### Unitaires (42 tests)

- `formatLegislature()` : AN, PE, SENAT + edge cases
- `percentage()` : calculs, division par zéro, edge cases
- `coverageClass()` : seuils 25%, 75%, edge cases
- `extractLegislatureNumber()` : 3 formats de chambre
- `sortLegislatureStats()` : 7 colonnes, asc/desc, immutabilité

### Intégration (12 tests)

- Promises résolues indépendamment
- Temps de chargement raisonnables
- Structure des données retournées
- Gestion des chambres sans données

Exécution :

```bash
npx vitest run src/routes/stats/data-quality/
```

Résultat attendu : 54/54 tests ✅

## Dark Mode

Les variables CSS utilisent le système de thèmes du projet :

- ✅ `var(--color-surface)` : background des cartes
- ✅ `var(--color-bg)` : background général
- ❌ ~~`var(--color-background)`~~ : n'existe pas dans les thèmes

Seuils de couleur des barres de progression :

- **>75%** : `coverage-high` (vert)
- **25-75%** : `coverage-medium` (orange)
- **<25%** : `coverage-low` (rouge)

## Filtres

### Filtre Chambre (client-side)

Boutons AN / PE / SENAT changent dynamiquement :

- Section 2 : affiche les stats de la chambre sélectionnée
- Section 3 : filtre le tableau sur la chambre

**Choix d'implémentation** : Pas d'onglet "Toutes les chambres" car le tableau mélangerait des formats de mandature incomparables (17e législature vs 10e terme).

## Patterns Réutilisables

### Pattern : Tri Côté Client

**Quand utiliser** : Datasets < 1000 lignes, besoin de réactivité instantanée

**Avantages** :

- Tri instantané (pas de round-trip serveur)
- Pas de rechargement de page
- Préserve l'état du filtre chambre

**Alternative** : Tri serveur via query params (`?sort=votes&dir=desc`)

### Pattern : Configuration Déclarative

**Principe** : Définir la structure des données dans une config, générer l'UI en boucle

**Avantages** :

- DRY : pas de duplication template
- Facilite l'ajout de colonnes
- Type-safe avec TypeScript

### Pattern : AsyncCard Streaming

**Principe** : Loader retourne des promises non résolues, composant gère le {#await}

**Avantages** :

- Skeleton automatique
- Erreur handling centralisé
- Parallélisation des requêtes

## Liens

- [SvelteKit Streaming](https://kit.svelte.dev/docs/load#streaming-with-promises)
- [WAI-ARIA Sortable Grid](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/)
- [PostgreSQL FILTER Clause](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES)
