# Pattern : Documentation de Composants Réutilisables

## Catégorie
Documentation / Best Practices / Svelte

## Date d'adoption
2026-02-04

## Contexte

Les composants réutilisables nécessitent une documentation complète pour :
- Faciliter la compréhension et l'utilisation
- Réduire les questions récurrentes
- Améliorer la maintenabilité à long terme
- Servir de référence pour futurs composants similaires

## Pattern de Documentation

### Structure de fichiers

```
src/lib/components/
├── MonComposant.svelte          # Composant principal
├── MonComposant.utils.ts        # Utilitaires (si extraction de logique)
├── MonComposant.test.ts         # Tests unitaires
└── MonComposant.README.md       # Documentation complète
```

### 1. JSDoc dans le fichier .utils.ts

**Obligatoire pour** :
- Interfaces publiques
- Fonctions exportées
- Constantes exportées

**Format** :
```typescript
/**
 * Description courte de la fonction
 *
 * Description longue avec contexte si nécessaire.
 *
 * @param paramName - Description du paramètre
 * @returns Description de ce qui est retourné
 *
 * @example
 * ```typescript
 * const result = myFunction(input);
 * // => expected output
 * ```
 *
 * @see {@link RelatedComponent} - Lien vers composant lié
 */
export function myFunction(paramName: Type): ReturnType {
  // ...
}
```

**Exemple réel** (GroupVotesStackedBar.utils.ts) :
```typescript
/**
 * Trie les groupes par total de votes (descendant) et limite le nombre
 *
 * Les groupes avec le plus de votes apparaissent en premier, permettant
 * d'afficher les groupes les plus significatifs dans les graphiques.
 *
 * @param groups - Tableau des groupes politiques avec leurs votes
 * @param maxGroups - Nombre maximum de groupes à retourner
 * @returns Nouveau tableau trié et limité (ne modifie pas l'original)
 *
 * @example
 * ```typescript
 * const groups = [
 *   { id: 'A', total: 10, ... },
 *   { id: 'B', total: 30, ... }
 * ];
 * sortAndLimitGroups(groups, 2);
 * // => [{ id: 'B', total: 30 }, { id: 'A', total: 10 }]
 * ```
 */
```

### 2. Commentaire de composant dans .svelte

Placer **avant** le `<script>` :

```svelte
<!--
  NomComposant - Description courte

  Description longue du composant et de son utilité.

  **Mode 1** : Description du premier mode
  **Mode 2** : Description du second mode (si applicable)

  @component
  @example
  ```svelte
  <script>
    import MonComposant from '$lib/components/MonComposant.svelte';
  </script>

  <MonComposant
    prop1="value"
    prop2={42}
  />
  ```

  @see {@link fichier-lié.ts} - Description du lien
-->
<script lang="ts">
  // ...
</script>
```

### 3. Documentation des Props

```typescript
interface Props {
  /** Description de prop1 (requis si pas de valeur par défaut) */
  prop1: string;
  
  /** Description de prop2 avec détails (défaut: 42) */
  prop2?: number;
  
  /** Description de prop3 avec enum (défaut: "mode-a") */
  prop3?: 'mode-a' | 'mode-b';
}
```

### 4. Fichier README.md

**Template complet** :

```markdown
# NomComposant

Description d'une ligne.

## Vue d'ensemble

Contexte et utilité du composant.

### Cas d'usage principaux

| Cas | Description |
|-----|-------------|
| Cas 1 | ... |
| Cas 2 | ... |

## Installation

Interne au projet / npm install si package externe

## Utilisation basique

```svelte
<script>
  import MonComposant from '...';
</script>

<MonComposant prop="value" />
```

## Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| prop1 | string | **requis** | ... |
| prop2 | number | 42 | ... |

### Interfaces TypeScript

```typescript
interface MonInterface {
  // ...
}
```

## Exemples d'utilisation

### Exemple 1 : Cas basique
### Exemple 2 : Cas avancé
### Exemple 3 : Intégration avec autre composant

## Architecture

### Fichiers
### Séparation des responsabilités
### Flux de données

## Tests

Commande pour lancer les tests + résumé de la couverture

## Personnalisation

Comment personnaliser le composant (CSS variables, props, etc.)

## Standards du projet

Liste des standards respectés avec checkboxes

## Cas d'usage réels

### Pages utilisant ce composant

| Page | Description |
|------|-------------|

### Évolutions possibles

- [ ] Feature 1
- [ ] Feature 2

## Dépannage

### Problème 1
**Cause** : ...
**Solution** : ...

### Problème 2
**Cause** : ...
**Solution** : ...

## Références

- Liens vers documentation externe
- Articles/ressources pertinentes

## Changelog

| Version | Date | Changements |
|---------|------|-------------|

## License

MIT / Autre
```

## Niveaux de Documentation

| Niveau | Quand l'utiliser | Éléments inclus |
|--------|------------------|-----------------|
| **Minimal** | Composant interne simple, usage évident | JSDoc sur fonctions publiques uniquement |
| **Standard** | Composant réutilisable normal | JSDoc + commentaire composant + Props doc |
| **Complet** | Composant complexe ou critique | Standard + README.md complet |

## Exemple Réel : GroupVotesStackedBar

### Fichiers créés
- `GroupVotesStackedBar.svelte` - Commentaire de 40 lignes
- `GroupVotesStackedBar.utils.ts` - JSDoc complète sur toutes les fonctions
- `GroupVotesStackedBar.README.md` - 200+ lignes avec tous les exemples

### Sections du README
✅ Vue d'ensemble avec tableau des modes
✅ Props avec interface TypeScript
✅ 4 exemples d'utilisation (basique, modes, intégration)
✅ Architecture (fichiers, flux de données)
✅ Tests (commande + couverture)
✅ Personnalisation (CSS variables)
✅ Standards du projet
✅ Cas d'usage réels
✅ Dépannage (3 problèmes courants)
✅ Références externes
✅ Changelog

## Checklist Documentation

### Avant de commencer
- [ ] Identifier le niveau de documentation requis
- [ ] Vérifier standards existants dans SERENA

### Pendant la documentation
- [ ] JSDoc sur toutes les fonctions/interfaces publiques
- [ ] Commentaire de composant dans .svelte
- [ ] Props documentées avec types et défauts
- [ ] Exemples de code testés et fonctionnels
- [ ] README.md si composant complexe

### Après documentation
- [ ] Vérifier que les exemples compilent
- [ ] Liens internes valides
- [ ] Orthographe et grammaire
- [ ] Mettre à jour workflow-current

## Bonnes Pratiques

### ✅ À faire
- **Exemples concrets** : Préférer des exemples réels tirés du projet
- **Code fonctionnel** : Tous les exemples doivent compiler
- **Contexte** : Expliquer le "pourquoi", pas juste le "quoi"
- **Cas d'usage réels** : Lister où le composant est utilisé
- **Dépannage** : Anticiper les erreurs courantes

### ❌ À éviter
- Documentation obsolète (synchro avec code)
- Exemples génériques non testés
- Trop de détails évidents
- Duplication info entre JSDoc et README
- Jargon sans explication

## Maintenance

### Quand mettre à jour
- ✅ Ajout de prop
- ✅ Changement de comportement
- ✅ Nouveau cas d'usage identifié
- ✅ Bug fréquent → section Dépannage

### Changelog
Toujours documenter les changements avec :
- Version sémantique
- Date
- Description des changements

## Exemples de JSDoc par Type

### Interface
```typescript
/**
 * Données de vote d'un groupe politique pour un scrutin
 *
 * @interface GroupData
 */
export interface GroupData {
  /** Identifiant unique du groupe (ex: "PO123456") */
  id: string;
  // ...
}
```

### Constante
```typescript
/**
 * Positions de vote dans l'ordre d'affichage standard
 *
 * Ordre cohérent avec les conventions UI du projet :
 * Pour (vert) → Contre (rouge) → Abstention (jaune) → Non-votant (gris)
 *
 * @constant
 */
export const VOTE_POSITIONS = ['Pour', 'Contre', 'Abstention', 'Non-votant'] as const;
```

### Fonction avec @internal
```typescript
/**
 * Mapping interne - ne pas utiliser directement
 *
 * @internal
 */
const internalMap = { ... };
```

## Outils

### Vérification
```bash
# Vérifier les liens markdown
npx markdown-link-check *.README.md

# Générer documentation TypeScript
npx typedoc --out docs src/
```

### Templates
Sauvegarder ce pattern dans SERENA pour référence future.

## Metrics de Qualité

| Indicateur | Cible | GroupVotesStackedBar |
|------------|-------|----------------------|
| Lignes README | 100+ | 250+ ✅ |
| Exemples fonctionnels | ≥3 | 4 ✅ |
| Sections dépannage | ≥2 | 3 ✅ |
| JSDoc coverage | 100% public API | 100% ✅ |

## Voir Aussi

- `std-reusable-components.md` - Standard composants réutilisables
- `layercake-charts-rule.md` - Standard graphiques LayerCake
- `ui-best-practices.md` - Standards UI généraux

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-04 | Création suite à documentation GroupVotesStackedBar |
