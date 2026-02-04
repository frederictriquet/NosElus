# GroupVotesStackedBar

Composant Svelte pour visualiser la répartition des votes par groupe politique avec deux modes d'affichage complémentaires.

## Vue d'ensemble

Ce composant affiche des graphiques en barres empilées (stacked bar charts) pour analyser les votes d'un scrutin. Il utilise [LayerCake](https://layercake.graphics/) conformément au standard du projet.

### Deux modes d'affichage

| Mode | Description | Axe X | Empilement | Couleurs |
|------|-------------|-------|------------|----------|
| **by-group** | Vue par groupe politique | Groupes (LFI, RN, etc.) | Positions de vote | Positions (vert/rouge/jaune/gris) |
| **by-position** | Vue par position de vote | Positions (Pour/Contre/etc.) | Groupes politiques | Groupes (couleurs des partis) |

## Installation

Aucune installation requise - composant interne du projet NosElus.

## Utilisation basique

```svelte
<script lang="ts">
  import GroupVotesStackedBar from '$lib/components/GroupVotesStackedBar.svelte';
  import type { GroupData } from '$lib/components/GroupVotesStackedBar.utils';

  // Données de vote chargées depuis le serveur
  let groups: GroupData[] = $props();
</script>

<!-- Mode "by-group" -->
<GroupVotesStackedBar
  {groups}
  mode="by-group"
  height={220}
/>
```

## Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `groups` | `GroupData[]` | **requis** | Tableau des groupes politiques avec leurs votes |
| `mode` | `'by-group' \| 'by-position'` | **requis** | Mode d'affichage du graphique |
| `height` | `number` | `250` | Hauteur du graphique en pixels |
| `maxGroups` | `number` | `10` | Nombre maximum de groupes à afficher (trié par total décroissant) |

### Interface GroupData

```typescript
interface GroupData {
  id: string;              // Identifiant unique (ex: "PO123456")
  name: string;            // Nom complet (ex: "La France Insoumise - NFP")
  shortName: string | null; // Nom court (ex: "LFI-NFP")
  color: string | null;    // Couleur hexadécimale (ex: "#C9462C")
  pour: number;            // Nombre de votes "Pour"
  contre: number;          // Nombre de votes "Contre"
  abstention: number;      // Nombre d'abstentions
  nonVotant: number;       // Nombre de non-votants
  total: number;           // Total des votes
}
```

## Exemples d'utilisation

### Exemple 1 : Intégration avec AsyncCard

Pattern recommandé pour les pages avec chargement asynchrone :

```svelte
<script lang="ts">
  import AsyncCard from '$lib/components/AsyncCard.svelte';
  import GroupVotesStackedBar from '$lib/components/GroupVotesStackedBar.svelte';

  let data = $props(); // Depuis +page.server.ts
</script>

<div class="charts-row">
  <!-- Graphique par groupe -->
  <AsyncCard title="Votes par groupe" promise={data.groupBreakdown}>
    {#snippet children(groups)}
      <GroupVotesStackedBar {groups} mode="by-group" height={220} />
    {/snippet}
  </AsyncCard>

  <!-- Graphique par position -->
  <AsyncCard title="Répartition par position" promise={data.groupBreakdown}>
    {#snippet children(groups)}
      <GroupVotesStackedBar {groups} mode="by-position" height={220} />
    {/snippet}
  </AsyncCard>
</div>

<style>
  .charts-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }
</style>
```

### Exemple 2 : Mode by-group (détail)

Affiche une barre par groupe politique, avec les positions de vote empilées :

```svelte
<GroupVotesStackedBar
  {groups}
  mode="by-group"
  height={300}
  maxGroups={8}
/>
```

**Rendu** :
- Axe X : LFI | RN | Renaissance | ... (jusqu'à 8 groupes)
- Axe Y : Nombre de votes (0 → max)
- Empilement : Pour (vert) → Contre (rouge) → Abstention (jaune) → Non-votant (gris)
- Légende : Affiche les 4 positions de vote

### Exemple 3 : Mode by-position (détail)

Affiche une barre par position de vote, avec les groupes politiques empilés :

```svelte
<GroupVotesStackedBar
  {groups}
  mode="by-position"
  height={300}
  maxGroups={10}
/>
```

**Rendu** :
- Axe X : Pour | Contre | Abstention | Non-votant
- Axe Y : Nombre de votes (0 → max)
- Empilement : Groupes politiques dans leurs couleurs respectives
- Légende : Affiche les groupes politiques avec leurs couleurs

### Exemple 4 : Limitation du nombre de groupes

Pour les scrutins avec de nombreux petits groupes :

```svelte
<GroupVotesStackedBar
  {groups}
  mode="by-position"
  height={250}
  maxGroups={5}
/>
```

Seuls les 5 groupes avec le plus de votes totaux seront affichés.

## Chargement des données (serveur)

Exemple de fonction `load` dans `+page.server.ts` :

```typescript
import { loadGroupVoteBreakdown } from '$lib/server/api/helpers';

export const load: PageServerLoad = async ({ params }) => {
  const loadGroupBreakdown = async () => {
    return await loadGroupVoteBreakdown(params.id, params.legislature);
  };

  return {
    // Promise streamée (pas de await ici)
    groupBreakdown: loadGroupBreakdown()
  };
};
```

## Architecture

### Fichiers

```
src/lib/components/
├── GroupVotesStackedBar.svelte          # Composant principal
├── GroupVotesStackedBar.utils.ts        # Utilitaires (logique pure)
├── GroupVotesStackedBar.test.ts         # Tests unitaires (16 tests)
└── GroupVotesStackedBar.README.md       # Cette documentation
```

### Séparation des responsabilités

| Fichier | Rôle | Dépendances |
|---------|------|-------------|
| `.svelte` | Rendu UI, intégration LayerCake | Svelte, LayerCake, D3 |
| `.utils.ts` | Transformation des données (pure) | TypeScript uniquement |
| `.test.ts` | Tests unitaires de la logique | Vitest, utilitaires |

### Flux de données

```
GroupData[] (serveur)
    ↓
prepareByGroupData() ou prepareByPositionData()
    ↓
{ seriesNames, dataForStack }
    ↓
d3-shape/stack()
    ↓
LayerCake → ColumnStacked.svelte
    ↓
Graphique SVG
```

## Tests

16 tests couvrent tous les cas d'usage :

```bash
# Lancer les tests
npm run test -- GroupVotesStackedBar.test.ts
```

**Couverture** :
- ✅ Tri et limitation des groupes
- ✅ Mode by-group (4 tests)
- ✅ Mode by-position (6 tests)
- ✅ Edge cases (groupes vides, noms longs, etc.)

## Personnalisation

### Couleurs des positions

Les couleurs sont définies dans le composant via des variables CSS :

```svelte
<script>
  const positionColors = {
    pour: 'var(--color-success, #4ade80)',      // Vert
    contre: 'var(--color-danger, #f87171)',     // Rouge
    abstention: 'var(--color-warning, #fbbf24)', // Jaune
    nonVotant: 'var(--color-text-muted, #9ca3af)' // Gris
  };
</script>
```

Pour personnaliser, définir les variables CSS dans votre thème :

```css
:root {
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-text-muted: #6b7280;
}
```

### Couleurs des groupes

Les couleurs proviennent de la base de données (colonne `organs.color`).
En mode by-position, le composant utilise ces couleurs automatiquement.

## Standards du projet

Ce composant respecte :
- ✅ **layercake-charts-rule** : Utilise LayerCake + ColumnStacked existant
- ✅ **std-reusable-components** : Props typées, réutilisable, testé
- ✅ **group-colors-rule** : Utilise les couleurs des groupes en DB
- ✅ **no-hardcoding-rule** : Couleurs via CSS variables

## Cas d'usage réels

### Pages utilisant ce composant

| Page | Mode(s) | Description |
|------|---------|-------------|
| `/an/scrutins/[id]` | both | Détail d'un scrutin à l'Assemblée nationale |

### Évolutions possibles

- [ ] Support du mode "stacked percentage" (100% normalisé)
- [ ] Export en PNG/SVG
- [ ] Tooltips interactifs au survol
- [ ] Filtrage dynamique des groupes

## Dépannage

### Problème : Graphique vide

**Cause** : Le tableau `groups` est vide ou tous les groupes ont `total: 0`.

**Solution** :
```svelte
{#if groups.length > 0}
  <GroupVotesStackedBar {groups} mode="by-group" />
{:else}
  <p>Aucune donnée de vote disponible</p>
{/if}
```

### Problème : Légende tronquée en mode by-position

**Cause** : Trop de groupes affichés (noms longs).

**Solution** : Réduire `maxGroups` :
```svelte
<GroupVotesStackedBar {groups} mode="by-position" maxGroups={6} />
```

### Problème : Couleurs incorrectes

**Cause** : Variable CSS non définie ou données `color: null`.

**Solution** :
1. Vérifier que les variables CSS sont définies dans votre thème
2. Vérifier que les groupes ont une couleur en base : `SELECT id, color FROM organs;`

## Références

- [LayerCake Documentation](https://layercake.graphics/)
- [D3 Stack Layout](https://github.com/d3/d3-shape#stacks)
- [Stacked Bar Charts Best Practices](https://datavizproject.com/data-type/stacked-bar-chart/)

## Changelog

| Version | Date | Changements |
|---------|------|-------------|
| 1.0.0 | 2026-02-04 | Version initiale avec deux modes |
| 1.1.0 | 2026-02-04 | Extraction des utilitaires + documentation complète |

## License

Interne au projet NosElus - MIT License
