# Analyse : Composant Réutilisable pour Noms de Partis au Hover

## Date
2026-02-01

## Contexte

L'utilisateur souhaite :
- Afficher le nom complet du parti (nom long) au survol du nom court
- Extraire le pattern de ElectedCard.svelte `.group-name-hover` 
- Créer un composant réutilisable
- L'appliquer partout où on affiche un nom de parti

## Pattern Existant dans ElectedCard.svelte

### Code HTML (lignes 89-95, 109-114, 128-132)

```svelte
<span class="group-name-hover">
  <span class="group-short">{group.shortName}</span>
  {#if group.name && group.name !== group.shortName}
    <span class="group-full">{group.name}</span>
  {/if}
</span>
```

### CSS (lignes 208-254)

```css
/* Animation commune nom court → nom complet au hover */
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
  animation: scroll-text 3s linear infinite;
}

@keyframes scroll-text {
  0%, 10% {
    transform: translateX(0);
  }
  45%, 55% {
    /* Scroll: -100% du texte + 100% du conteneur (100cqi) */
    transform: translateX(min(0px, calc(-100% + 100cqi)));
  }
  90%, 100% {
    transform: translateX(0);
  }
}
```

## Fonctionnement

1. **Affichage initial** : Nom court visible, nom long caché (opacity: 0)
2. **Au hover** : Transition avec fade du nom court vers nom long
3. **Animation scroll** : Si le nom long dépasse le conteneur, il scrolle horizontalement (3s loop)
4. **Container queries** : Utilise `container-type: inline-size` pour adapter le scroll à la largeur disponible

## Composant Cible à Créer

### Nom suggéré
`GroupName.svelte`

### Props
```typescript
interface Props {
  shortName?: string | null;
  fullName?: string | null;
  /** Affichage inline ou block */
  variant?: 'inline' | 'block';
}
```

### Usage attendu

```svelte
<!-- Au lieu de -->
<span>{group.shortName}</span>

<!-- Utiliser -->
<GroupName shortName={group.shortName} fullName={group.name} />
```

## Fichiers à Modifier

### Fichiers identifiés avec affichage de noms de groupes

**12 fichiers Svelte trouvés** avec usage de `group.shortName` ou `group.name` :

#### 1. **ElectedCard.svelte** (À CONVERTIR EN PREMIER)
- **Usage actuel** : Pattern `.group-name-hover` avec animation scroll (3 variantes)
- **Lignes** : 89-95 (inline), 109-114 (compact), 128-132 (full)
- **Action** : Remplacer par `<GroupName>` - validation que le composant fonctionne

#### 2. **ProfileHeader.svelte** (PATTERN DIFFÉRENT)
- **Usage actuel** : Affiche short + full en vertical dans un badge (lignes 88-93)
- **Pattern** : `.group-label` avec `.group-short` (bold) au-dessus de `.group-full` (small, opacity 0.85)
- **Action** : Ce pattern est différent (affichage vertical simultané, pas de hover). À discuter si on veut l'unifier.

#### 3. **Routes pages groupes** (AFFICHAGE LISTE)
- `src/routes/an/groupes/+page.svelte`
- `src/routes/pe/groupes/+page.svelte`
- `src/routes/senat/groupes/+page.svelte`
- **Usage actuel** : Affichage du nom long comme titre + nom court en metadata
- **Action** : Probablement pas nécessaire de changer (contexte différent : liste de tous les groupes)

#### 4. **Routes détail groupe** 
- `src/routes/an/groupes/[id]/+page.svelte`
- `src/routes/pe/groupes/[id]/+page.svelte`
- `src/routes/senat/groupes/[id]/+page.svelte`
- **Action** : À examiner

#### 5. **Routes scrutins**
- `src/routes/an/scrutins/[id]/+page.svelte`
- **Action** : À examiner (probablement affichage des groupes qui ont voté)

#### 6. **Routes stats**
- `src/routes/an/stats/+page.svelte`
- `src/routes/pe/stats/+page.svelte`
- **Action** : À examiner (classements par groupe)

#### 7. **Route recherche**
- `src/routes/recherche/+page.svelte`
- **Action** : À examiner (résultats de recherche)

### Stratégie de Migration

#### Phase 1 : Création du composant
1. **Créer** `src/lib/components/GroupName.svelte`
2. **Extraire** CSS (animation scroll) et HTML de ElectedCard.svelte
3. **Variantes** : Inline (hover avec scroll) vs Badge (ProfileHeader style)

#### Phase 2 : Migration prioritaire
1. **ElectedCard.svelte** - Remplacer les 3 occurrences du pattern hover
2. **Tests visuels** - Vérifier que toutes les pages avec ElectedCard fonctionnent
3. **ProfileHeader.svelte** - Décider si on unifie ou si on garde le pattern vertical

#### Phase 3 : Migration progressive
Pour chaque fichier route :
1. Examiner le contexte d'affichage
2. Déterminer si le composant `GroupName` apporte une vraie valeur
3. Migrer si pertinent

#### Phase 4 : Nettoyage
- Supprimer les styles dupliqués de `.group-name-hover` dans ElectedCard.svelte

### Priorités

**P0 (Critique)** :
- ElectedCard.svelte - Composant le plus réutilisé, pattern déjà implémenté

**P1 (Important)** :
- ProfileHeader.svelte - Décision d'architecture à prendre

**P2 (Nice to have)** :
- Routes scrutins/stats - Si affichage inline de noms courts
- Routes recherche - Idem

**Hors scope** :
- Routes listes de groupes - Affichent déjà nom long + court séparément

## Considérations Techniques

### Accessibilité
- Le nom complet devrait être accessible aux lecteurs d'écran dès le départ
- Utiliser `aria-label` ou `title` avec le nom complet

### Performance
- CSS pur, pas de JavaScript
- Animation légère (transition + translate)
- Pas de re-render au hover

### Réutilisabilité
- Props simples et claires
- Styles encapsulés
- Variants pour s'adapter aux différents contextes

## Décisions à Prendre

### 1. Nom du composant
- **Option A** : `GroupName.svelte` (simple, clair)
- **Option B** : `GroupLabel.svelte` (plus neutre)
- **Recommandation** : GroupName.svelte

### 2. Variantes
- **Variante 1** : Hover avec scroll (ElectedCard actuel)
- **Variante 2** : Affichage vertical simultané (ProfileHeader actuel)
- **Question** : Un seul composant avec 2 modes ou 2 composants distincts ?

### 3. Props API
```typescript
interface Props {
  shortName?: string | null;
  fullName?: string | null;
  // Mode d'affichage
  variant?: 'hover' | 'stacked'; // hover = ElectedCard, stacked = ProfileHeader
}
```

## Estimation

- **Temps de création** : ~30min (composant + tests)
- **Migration ElectedCard** : ~15min (3 remplacements)
- **Tests visuels** : ~30min (vérifier toutes les pages)
- **TOTAL** : ~1h15

## Prochaines Étapes

1. ✅ **Analyse terminée** - Ce document
2. ⬜ `/architecture` - Designer précisément le composant GroupName.svelte
3. ⬜ `/implement` - Créer le composant et migrer ElectedCard
4. ⬜ `/test-write` - Tests unitaires si nécessaire
5. ⬜ `/test-run` - Tests visuels sur les pages concernées
6. ⬜ `/code-review` - Review avant merge
7. ⬜ `/pre-merge` - Préparer la PR
8. ⬜ `/roadmap-update` - Mettre à jour roadmap si feature trackée
9. ⬜ `/capitalize` - Documenter le pattern

## Références

- **ElectedCard.svelte:208-254** - CSS existant pour animation hover
- **ElectedCard.svelte:89-95, 109-114, 128-132** - HTML pour pattern hover
- **ProfileHeader.svelte:88-93** - Pattern vertical alternatif
- **Memories** :
  - `group-colors-rule.md` - Règles sur les couleurs de groupes
  - `ui-best-practices.md` - Standards UI du projet
