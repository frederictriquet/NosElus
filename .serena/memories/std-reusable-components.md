# Standard : Composants Réutilisables Svelte

## Catégorie
Architecture | Components | UI

## Règle

**Lorsqu'un pattern UI apparaît 3 fois ou plus dans le code, extraire un composant réutilisable.**

Critères pour l'extraction :
1. Le pattern est utilisé dans ≥3 endroits
2. Le pattern a une logique/style commun
3. La réutilisation améliore la maintenabilité
4. Le composant peut être paramétré via props

## Justification

### Problèmes résolus
- **DRY** : Élimination de la duplication de code/CSS
- **Maintenabilité** : Changement centralisé au lieu de N fichiers
- **Cohérence** : Style et comportement uniformes
- **Testabilité** : Tests centralisés sur le composant

### Cas réel : GroupName.svelte
Pattern `.group-name-hover` dupliqué dans :
- ElectedCard.svelte (3 occurrences)
- Plusieurs routes (carte, stats, scrutins)

**Avant extraction** :
- ~45 lignes de CSS dupliquées par fichier
- Risque d'inconsistance si modification
- Modification = éditer N fichiers

**Après extraction** :
- 1 composant réutilisable = 137 lignes
- Modification = 1 fichier
- 13 fichiers utilisant le composant

## Exemples

### ✅ Correct : Composant Réutilisable

```svelte
<!-- src/lib/components/GroupName.svelte -->
<script lang="ts">
  interface Props {
    shortName?: string | null;
    fullName?: string | null;
    variant?: 'hover' | 'stacked';
    class?: string;
  }
  
  let { 
    shortName = null, 
    fullName = null, 
    variant = 'hover', 
    class: className = '' 
  }: Props = $props();
  
  // Logique réutilisable
  const hasFullName = $derived(fullName && fullName !== shortName);
</script>

<!-- Template avec variants -->
{#if variant === 'hover'}
  <span class="hover {className}">
    <span>{shortName}</span>
    <span class="tooltip">{fullName}</span>
  </span>
{/if}

<style>
  /* Style centralisé */
  .hover { position: relative; }
  .tooltip { /* ... */ }
</style>
```

**Utilisation** :
```svelte
<script>
  import GroupName from '$lib/components/GroupName.svelte';
</script>

<GroupName shortName="LFI" fullName="La France Insoumise" />
```

### ❌ Incorrect : Duplication du Pattern

```svelte
<!-- ElectedCard.svelte -->
<span class="group-name-hover">
  <span class="group-short">{group.shortName}</span>
  <span class="tooltip">{group.name}</span>
</span>

<style>
  .group-name-hover { position: relative; }
  .tooltip { /* 45 lignes de CSS */ }
</style>

<!-- ProfileHeader.svelte - DUPLICATION -->
<span class="group-name-hover">
  <span class="group-short">{group.shortName}</span>
  <span class="tooltip">{group.name}</span>
</span>

<style>
  .group-name-hover { position: relative; }
  .tooltip { /* 45 lignes de CSS DUPLIQUÉES */ }
</style>
```

## Anatomie d'un Bon Composant Réutilisable

### 1. Props Interface Typé (TypeScript)
```typescript
interface Props {
  // Props obligatoires
  id: string;
  
  // Props optionnelles avec valeurs par défaut
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  
  // Class CSS custom
  class?: string;
  
  // Children/slot support
  children?: Snippet;
}
```

### 2. Logique Réutilisable ($derived)
```typescript
// Computed properties
const isActive = $derived(status === 'active');
const displayValue = $derived(shortValue || longValue || '');
```

### 3. Variants Support
```svelte
{#if variant === 'primary'}
  <!-- Primary rendering -->
{:else if variant === 'secondary'}
  <!-- Secondary rendering -->
{/if}
```

### 4. CSS Modulaire
```svelte
<style>
  /* Base styles */
  .component { /* ... */ }
  
  /* Variants */
  .primary { /* ... */ }
  .secondary { /* ... */ }
  
  /* Responsive */
  @media (max-width: 768px) { /* ... */ }
</style>
```

### 5. Accessibilité
```svelte
<span 
  role="tooltip"
  aria-label={fullName}
  tabindex="0"
>
  {shortName}
</span>
```

## Checklist : Créer un Composant Réutilisable

### Avant l'extraction
- [ ] Pattern utilisé ≥3 fois dans le code
- [ ] Pattern a une logique/style cohérent
- [ ] Variations du pattern sont paramétrables

### Pendant la création
- [ ] Interface Props typée avec TypeScript
- [ ] Props avec valeurs par défaut sensées
- [ ] Support `class` prop pour customisation
- [ ] Variants clairement définis
- [ ] Documentation JSDoc sur les props
- [ ] Gestion des cas edge (null, undefined)

### Après la création
- [ ] Migration de tous les usages existants
- [ ] Suppression du code dupliqué
- [ ] Tests du composant (si critique)
- [ ] Documentation d'utilisation

## Workflow d'Extraction

```
1. IDENTIFIER
   ↓
   Trouver le pattern répété (grep, glob)
   
2. ANALYSER
   ↓
   Identifier variations et points communs
   
3. DESIGNER L'API
   ↓
   Définir Props interface
   
4. CRÉER
   ↓
   Implémenter le composant
   
5. MIGRER
   ↓
   Remplacer tous les usages
   
6. NETTOYER
   ↓
   Supprimer le code dupliqué
   
7. DOCUMENTER
   ↓
   Ajouter exemples d'usage
```

## Exemples de Composants Réutilisables dans le Projet

| Composant | Utilité | Usages |
|-----------|---------|--------|
| `GroupName.svelte` | Affichage nom parti avec tooltip | 13 fichiers |
| `ElectedCard.svelte` | Carte d'élu | Listes députés/sénateurs |
| `AsyncCard.svelte` | Carte avec chargement async | Pages avec promises |
| `VoteDistributionCard.svelte` | Distribution des votes | Pages scrutins |

## Anti-Patterns à Éviter

### ❌ Composant trop spécifique
```svelte
<!-- DeputyFromParis15thCard.svelte - TROP SPÉCIFIQUE -->
```
**Problème** : Pas réutilisable, devrait être paramétré.

### ❌ Composant trop générique
```svelte
<!-- UniversalComponent.svelte - TROP GÉNÉRIQUE -->
<script>
  let { type, mode, variant, style, size, theme, ... } = $props();
  // 50 props différentes
</script>
```
**Problème** : API trop complexe, difficile à maintenir.

### ❌ Props avec logique business
```svelte
<!-- ❌ Mauvais -->
<script>
  let { fetchUserFromAPI } = $props();  // Logique métier
</script>

<!-- ✅ Bon -->
<script>
  let { user } = $props();  // Données uniquement
</script>
```

## Exceptions

### Quand NE PAS extraire un composant

1. **Pattern utilisé <3 fois** : Pas encore de pattern établi
2. **Variations trop différentes** : Forcer l'unification serait artificiel
3. **Contexte très spécifique** : Lié à une page unique
4. **Overhead de maintenance** : Composant plus complexe que duplication

### Exemple d'exception valide
```svelte
<!-- Page de login - formulaire unique au projet -->
<form class="login-form">
  <!-- Pas besoin d'extraire en LoginForm.svelte -->
</form>
```

## Vérification

### Code Review Checklist
- [ ] Nouveau code duplique-t-il un pattern existant ?
- [ ] Si oui, un composant existe-t-il déjà ?
- [ ] Sinon, peut-on créer/étendre un composant ?

### Outils
- `grep -r "class=\"group-name"` - Trouver duplications CSS
- `rg "const.*=.*\$derived"` - Trouver logique dupliquée

## Date d'adoption
2026-02-01

## Références
- Memory: `pattern-reusable-tooltip-component.md` - Exemple pattern
- Memory: `ui-best-practices.md` - Standards UI
- [Svelte Component Best Practices](https://svelte.dev/docs/svelte-components)
- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)

## Historique
| Date | Modification |
|------|--------------|
| 2026-02-01 | Création suite à extraction de GroupName.svelte |
