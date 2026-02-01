# Architecture : Composant GroupName.svelte

## Date
2026-02-01

## Vue d'Ensemble

### Diagramme de composants

```
┌─────────────────────────────────────────────────────────────────┐
│                     GroupName.svelte                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Props: shortName, fullName, variant, class                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Variant: 'hover'                         │   │
│  │  ┌─────────────┐  hover  ┌─────────────────────────┐    │   │
│  │  │ group-short │ ──────▶ │ group-full + scroll anim│    │   │
│  │  └─────────────┘         └─────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Variant: 'stacked'                       │   │
│  │  ┌─────────────┐                                        │   │
│  │  │ group-short │ (bold, larger)                         │   │
│  │  ├─────────────┤                                        │   │
│  │  │ group-full  │ (small, muted) - always visible        │   │
│  │  └─────────────┘                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Fallback: Si fullName absent ou = shortName → affiche short    │
│  Accessibilité: aria-label avec fullName pour screen readers    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Utilisateurs du composant

```
                          GroupName.svelte
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ElectedCard.svelte   ProfileHeader.svelte   Routes/*
    (variant: hover)      (variant: stacked)    (variant: hover)
```

## Interface TypeScript

```typescript
// GroupName.svelte - Props Interface

interface Props {
  /** Nom court/abréviation du groupe (ex: "RN", "LFI") */
  shortName?: string | null;
  
  /** Nom complet du groupe (ex: "Rassemblement National") */
  fullName?: string | null;
  
  /** 
   * Mode d'affichage :
   * - 'hover' : Nom court visible, nom long au survol avec animation scroll
   * - 'stacked' : Nom court et long empilés verticalement
   * Default: 'hover'
   */
  variant?: 'hover' | 'stacked';
  
  /** Classes CSS additionnelles */
  class?: string;
}
```

## Comportement Détaillé

### Logique d'affichage

```
┌──────────────────────────────────────────────────────────────┐
│                      DECISION TREE                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  shortName null/undefined?                                   │
│       │                                                      │
│       ├── OUI → Affiche fullName ou vide                     │
│       │                                                      │
│       └── NON → shortName existe                             │
│              │                                               │
│              └── fullName null/undefined OU fullName === shortName?
│                     │                                        │
│                     ├── OUI → Affiche seulement shortName    │
│                     │         (pas de hover/stacked)         │
│                     │                                        │
│                     └── NON → Affiche selon variant          │
│                           │                                  │
│                           ├── hover: animation au survol     │
│                           │                                  │
│                           └── stacked: empilé verticalement  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Variant 'hover' - Animation détaillée

```css
/* État initial */
.group-short { opacity: 1; }
.group-full  { opacity: 0; position: absolute; }

/* Au hover */
.group-short { opacity: 0; }
.group-full  { 
  opacity: 1; 
  animation: scroll-text 3s linear infinite;
}

/* Animation scroll (si texte dépasse) */
@keyframes scroll-text {
  0%, 10%   { transform: translateX(0); }
  45%, 55%  { transform: translateX(min(0px, calc(-100% + 100cqi))); }
  90%, 100% { transform: translateX(0); }
}
```

### Variant 'stacked' - Layout

```
┌─────────────────────┐
│ RN                  │ ← shortName (font-weight: 600)
│ Rassemblement Nat.  │ ← fullName (font-size: 0.75rem, opacity: 0.85)
└─────────────────────┘
```

## Structure du Fichier

```
src/lib/components/
└── GroupName.svelte    # Composant unique avec 2 variantes
```

### Template Svelte

```svelte
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

  // Calcul si on doit afficher la version étendue
  const hasFullName = $derived(
    fullName && fullName !== shortName
  );
  
  // Ce qu'on affiche si pas de shortName
  const displayName = $derived(shortName || fullName || '');
</script>

{#if !hasFullName}
  <!-- Simple display - no hover/stacked needed -->
  <span class="group-name-simple {className}">{displayName}</span>
{:else if variant === 'stacked'}
  <!-- Stacked variant -->
  <span class="group-name-stacked {className}" aria-label={fullName}>
    <span class="group-short">{shortName}</span>
    <span class="group-full">{fullName}</span>
  </span>
{:else}
  <!-- Hover variant (default) -->
  <span class="group-name-hover {className}" aria-label={fullName}>
    <span class="group-short">{shortName}</span>
    <span class="group-full">{fullName}</span>
  </span>
{/if}
```

## Styles CSS

### Approche

1. **Styles encapsulés** dans le composant (scoped)
2. **Variables CSS** pour personnalisation si besoin
3. **Container queries** pour animation scroll responsive

### CSS Complet

```css
/* Simple display */
.group-name-simple {
  white-space: nowrap;
}

/* ===== HOVER VARIANT ===== */
.group-name-hover {
  display: block;
  position: relative;
  cursor: default;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  container-type: inline-size;
}

.group-name-hover .group-short,
.group-name-hover .group-full {
  white-space: nowrap;
  display: block;
}

.group-name-hover .group-full {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  pointer-events: none;
}

.group-name-hover:hover .group-short {
  opacity: 0;
}

.group-name-hover:hover .group-full {
  opacity: 1;
  pointer-events: auto;
  animation: group-scroll-text 3s linear infinite;
}

@keyframes group-scroll-text {
  0%, 10% {
    transform: translateX(0);
  }
  45%, 55% {
    transform: translateX(min(0px, calc(-100% + 100cqi)));
  }
  90%, 100% {
    transform: translateX(0);
  }
}

/* ===== STACKED VARIANT ===== */
.group-name-stacked {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.group-name-stacked .group-short {
  font-weight: 600;
}

.group-name-stacked .group-full {
  font-size: 0.75rem;
  font-weight: 400;
  opacity: 0.85;
}
```

## Plan de Migration

### Phase 1 : Créer le composant
- Fichier : `src/lib/components/GroupName.svelte`
- Tests visuels manuels

### Phase 2 : Migrer ElectedCard.svelte

**Avant** (3 occurrences) :
```svelte
<span class="group-name-hover">
  <span class="group-short">{group.shortName}</span>
  {#if group.name && group.name !== group.shortName}
    <span class="group-full">{group.name}</span>
  {/if}
</span>
```

**Après** :
```svelte
<GroupName shortName={group.shortName} fullName={group.name} />
```

**CSS à supprimer** de ElectedCard.svelte :
- Lignes 208-254 (tout le bloc `.group-name-hover` et keyframes)

### Phase 3 : Migrer ProfileHeader.svelte

**Avant** (lignes 88-93) :
```svelte
<span class="group-label">
  <span class="group-short">{group.shortName || group.name}</span>
  {#if group.name && group.shortName && group.name !== group.shortName}
    <span class="group-full">{group.name}</span>
  {/if}
</span>
```

**Après** :
```svelte
<GroupName 
  shortName={group.shortName} 
  fullName={group.name} 
  variant="stacked" 
  class="group-label"
/>
```

**CSS à supprimer** de ProfileHeader.svelte :
- `.group-label`, `.group-short`, `.group-full` (lignes 185-199)

### Phase 4 : Autres migrations (optionnel)

Examiner les routes identifiées et migrer si pertinent :
- `/an/scrutins/[id]` - groupes dans les votes
- `/an/stats`, `/pe/stats` - classements
- `/recherche` - résultats de recherche

## Considérations

### Accessibilité
- `aria-label={fullName}` sur le conteneur pour screen readers
- Le nom complet est toujours accessible, pas seulement au hover

### Performance
- CSS pur, pas de JavaScript pour l'animation
- Container queries supportées par tous les navigateurs modernes
- Pas de re-render au hover

### Compatibilité
- `container-type: inline-size` : Chrome 105+, Firefox 110+, Safari 16+
- Fallback graceful : sans container queries, pas de scroll mais hover fonctionne

## Export du composant

Ajouter dans `src/lib/components/index.ts` (si existe) :
```typescript
export { default as GroupName } from './GroupName.svelte';
```

## Checklist de Validation

- [x] Interface Props clairement définie
- [x] 2 variantes documentées (hover, stacked)
- [x] Logique de fallback définie
- [x] Accessibilité assurée (aria-label)
- [x] Styles encapsulés
- [x] Plan de migration détaillé
- [x] CSS existant identifié pour suppression

## Références

- **Pattern source** : ElectedCard.svelte:89-95, 109-114, 128-132, 208-254
- **Pattern alternatif** : ProfileHeader.svelte:88-93, 185-199
- **Analyse** : `analysis-2026-02-01-group-name-hover-component.md`
