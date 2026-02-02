# Pattern : Composant Réutilisable avec Tooltip CSS

## Problème
Afficher une information courte (nom abrégé) avec une info complète au survol, de manière élégante et réutilisable, sans dépendre de tooltips système basiques.

## Contexte
**Quand utiliser ce pattern** :
- Affichage de noms courts (acronymes, sigles) avec version complète
- Besoin de tooltip stylisé cohérent avec le design de l'app
- Volonté d'éviter les tooltips système (`title` attribute)
- Réutilisation du même pattern à plusieurs endroits

**Cas d'usage dans le projet** :
- Noms de partis politiques : "LFI" → "La France Insoumise"
- Groupes parlementaires avec versions longues

## Solution

### Architecture du Composant

Créer un composant Svelte générique avec :
1. **Props flexibles** : shortName, fullName, variant
2. **Tooltip CSS pur** : Pas de JS, uniquement `:hover`
3. **Variants** : Support de plusieurs modes d'affichage

### Code

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
  
  const hasFullName = $derived(fullName && fullName !== shortName);
  const displayName = $derived(shortName || fullName || '');
</script>

{#if !hasFullName}
  <span class="group-name-simple {className}">{displayName}</span>
{:else if variant === 'stacked'}
  <span class="group-name-stacked {className}">
    <span class="group-short">{shortName}</span>
    <span class="group-full">{fullName}</span>
  </span>
{:else}
  <span class="group-name-hover {className}">
    <span class="group-short">{shortName}</span>
    <span class="tooltip">{fullName}</span>
  </span>
{/if}

<style>
  .group-name-hover {
    position: relative;
    display: inline-block;
    cursor: help;
  }
  
  .tooltip {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: 130%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-bg-tertiary);
    color: var(--color-text);
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    white-space: nowrap;
    z-index: 1000;
    font-size: 0.875rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: opacity 0.2s, visibility 0.2s;
    pointer-events: none;
  }
  
  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--color-bg-tertiary);
  }
  
  .group-name-hover:hover .tooltip {
    visibility: visible;
    opacity: 1;
  }
  
  .group-name-stacked {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .group-short {
    font-weight: 600;
  }
  
  .group-full {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }
</style>
```

### Utilisation

```svelte
<script>
  import GroupName from '$lib/components/GroupName.svelte';
</script>

<!-- Mode tooltip (par défaut) -->
<GroupName shortName="LFI" fullName="La France Insoumise" />

<!-- Mode stacked (vertical) -->
<GroupName 
  shortName="RE" 
  fullName="Renaissance" 
  variant="stacked" 
/>

<!-- Sans nom long (affiche juste le court) -->
<GroupName shortName="NI" />
```

## Avantages

1. **Réutilisabilité** : Un seul composant pour tout le projet
2. **Maintenabilité** : Changement de style centralisé
3. **Performance** : CSS pur, pas de JS pour le tooltip
4. **Accessibilité** : `cursor: help` + `aria-label` pour screen readers
5. **Flexibilité** : Variants multiples selon les besoins UI
6. **Cohérence** : Design uniforme partout

## Inconvénients

1. **Tooltip fixe** : Pas de positionnement dynamique (peut sortir de l'écran)
2. **Mobile** : `:hover` ne fonctionne pas bien sur tactile (besoin de `@media (hover: hover)`)
3. **Complexité** : Ajouter des variants peut complexifier le composant

## Exemples d'utilisation dans le projet

- `src/lib/components/ElectedCard.svelte:52` - Carte de député/élu
- `src/lib/components/ProfileHeader.svelte:78` - En-tête de profil (variant stacked)
- `src/routes/an/carte/+page.svelte:124` - Légende de la carte
- `src/routes/an/scrutins/[id]/+page.svelte:128` - Vote par groupe
- `src/routes/an/stats/+page.svelte:167` - Groupes les plus actifs

## Patterns Liés

- **Composant générique avec variants** : Même approche pour d'autres composants UI
- **CSS Tooltips** : Techniques de positionnement et styling
- **$derived en Svelte 5** : Computed properties réactives

## Leçons Apprises

### Itération sur le design
- **V1** : Tooltip avec animation scroll → trop complexe dans certains layouts
- **V2** : Tooltip pur uniquement → plus simple, fonctionne partout
- **Apprentissage** : Commencer simple, ajouter la complexité uniquement si nécessaire

### Props API Design
```typescript
// ❌ Mauvais : trop de flags
{ hoverMode: 'scroll' | 'tooltip', variant: 'hover' | 'stacked' }

// ✅ Bon : variant unique et clair
{ variant: 'hover' | 'stacked' }
```

### Gestion des cas edge
- Si `fullName === shortName` → N'afficher qu'une fois
- Si `fullName` est null → Afficher juste `shortName`
- Si les deux sont null → Afficher chaîne vide

## Voir aussi

- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/$derived)
- [CSS Tooltips Best Practices](https://css-tricks.com/css-tooltips/)
- Memory: `ui-best-practices.md` - Standards UI du projet

## Date de Création
2026-02-01
