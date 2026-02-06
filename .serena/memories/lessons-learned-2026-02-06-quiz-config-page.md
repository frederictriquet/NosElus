# Lessons Learned : Page de Configuration Quiz Politique

## Date
2026-02-06

## Contexte

Implémentation d'une page de configuration permettant à l'utilisateur de personnaliser son quiz (tags, taille) avant de démarrer, au lieu de lancer directement le quiz.

## Décision Prise

**Phase setup dédiée** dans la même route (`/an/quiz`) avec état `phase: 'setup' | 'quiz'` plutôt qu'une route séparée (`/an/quiz/setup`).

## Ce Qui a Bien Fonctionné ✅

### 1. Stratification côté client

**Décision** : Déplacer la logique de filtrage/stratification du serveur vers le client.

**Avantages constatés** :
- Filtrage en temps réel : compteur "X lois disponibles" se met à jour instantanément quand l'utilisateur coche/décoche des tags
- Aucun rechargement de page nécessaire
- Boutons de taille dynamiquement activés/désactivés selon les lois filtrées
- Meilleure UX : feedback immédiat

**Code clé** :
```typescript
// Client : quiz-selection.ts
export function selectQuizLaws(
  allLaws: QuizLaw[],
  selectedTagSlugs: Set<string>,
  quizSize: number
): SelectionResult {
  // Filtrage + stratification en temps réel
}
```

**Alternative rejetée** : Requête serveur à chaque changement de tags → trop lent, mauvaise UX.

### 2. Phase setup dans la même route

**Décision** : Une seule route `/an/quiz` avec `phase: 'setup' | 'quiz'` au lieu de deux routes.

**Avantages** :
- Pas de navigation supplémentaire (pas de `goto('/an/quiz/start')`)
- localStorage permet de reprendre directement le quiz si en cours (skip setup)
- URL simple et cohérente
- Moins de fichiers à maintenir

**Code clé** :
```svelte
{#if phase === 'setup'}
  <QuizSetup {availableTags} {allLaws} {onStart} />
{:else}
  <!-- Quiz phase -->
{/if}
```

### 3. Tous les tags cochés par défaut

**Décision** : `selectedSlugs = new Set(availableTags.map(t => t.slug))` au démarrage.

**Avantages** :
- Encourage l'utilisateur à découvrir toutes les thématiques
- Comportement intuitif : décocher ce qui n'intéresse pas (opt-out) plutôt que cocher tout (opt-in)
- Affiche immédiatement le nombre total de lois disponibles

**Confirmation utilisateur** : L'utilisateur n'a pas demandé d'autre comportement, celui-ci semble naturel.

### 4. Auto-ajustement de la taille

**Décision** : Réduire automatiquement `quizSize` si le nombre de lois disponibles diminue sous la taille choisie.

**Code** :
```typescript
$effect(() => {
  if (availableSizes.length > 0 && !availableSizes.includes(quizSize)) {
    quizSize = availableSizes[availableSizes.length - 1];
  }
});
```

**Résultat** : L'utilisateur ne peut jamais être bloqué avec un bouton "Commencer" désactivé à cause d'une taille trop grande.

### 5. Style `color-mix()` cohérent avec TagBadge

**Décision** : Réutiliser le pattern `color-mix(in srgb, var(--tag-color) X%, transparent)` existant.

**Avantages** :
- Cohérence visuelle avec le reste du site
- Pas de duplication de code CSS
- Styles dark mode automatiquement gérés

## Problèmes Rencontrés et Solutions 🔧

### Problème 1 : Setup immédiatement remplacé

**Symptôme** : La page setup s'affichait puis était immédiatement remplacée par le quiz.

**Cause** : localStorage contenait un quiz en cours (`noselus-quiz-votes`) depuis un test précédent.

**Solution** :
```typescript
onMount(() => {
  const stored = localStorage.getItem('noselus-quiz-votes');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.laws?.length > 0 && !parsed.completedAt) {
        phase = 'quiz'; // Reprendre directement
        return;
      }
    } catch {
      // localStorage corrompu, on l'ignore
    }
  }
  // Pas de quiz en cours → afficher setup
});
```

**Leçon** : Toujours prévoir un état "quiz en cours" détectable pour permettre la reprise.

### Problème 2 : `enrichWithTags` O(n*m)

**Symptôme détecté en code review** : `.filter()` par loi pour trouver ses tags = O(n*m).

**Solution** : Indexation avec Map.
```typescript
const tagsByLawId = new Map<string, Tag[]>();
for (const lt of lawTagsData) {
  if (!tagsByLawId.has(lt.lawId)) {
    tagsByLawId.set(lt.lawId, []);
  }
  tagsByLawId.get(lt.lawId)!.push({ slug: lt.slug, name: lt.name, color: lt.color });
}
// Puis : tags: tagsByLawId.get(law.id) ?? []
```

**Impact** : Avec ~32 lois et ~50 associations, l'impact est négligeable, mais le code est plus propre.

### Problème 3 : `.sort(() => Math.random() - 0.5)` biaisé

**Symptôme détecté en code review** : Shuffle non uniforme.

**Solution** : Fisher-Yates.
```typescript
function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

**Leçon** : Toujours utiliser Fisher-Yates pour un shuffle uniforme, même si le biais de `.sort(() => Math.random() - 0.5)` est faible en pratique.

## Patterns Réutilisables 🔄

### Pattern 1 : Configuration page avant action

**Cas d'usage** : Import de données, création d'entité complexe, lancement de processus.

**Structure** :
```svelte
<script>
  let phase = $state<'config' | 'action'>('config');
  
  function handleStart(config) {
    // Valider config, initialiser état
    phase = 'action';
  }
</script>

{#if phase === 'config'}
  <ConfigComponent {onStart} />
{:else}
  <ActionComponent />
{/if}
```

**Avantages** :
- UX claire : l'utilisateur comprend qu'il configure avant d'agir
- Validation en amont : impossible de lancer avec une config invalide
- Reprise possible : localStorage + détection d'état

### Pattern 2 : Filtrage client en temps réel

**Cas d'usage** : Sélection d'éléments avec filtres multiples et compteur.

**Code** :
```svelte
<script>
  let selectedFilters = $state<Set<string>>(new Set(allFilters));
  
  const filteredItems = $derived(
    allItems.filter(item => item.tags.some(t => selectedFilters.has(t)))
  );
  
  const availableActions = $derived(
    getAvailableActions(filteredItems.length)
  );
</script>

<p>{filteredItems.length} éléments disponibles</p>
<!-- Actions dynamiquement activées/désactivées -->
```

**Avantages** : Feedback immédiat, pas de latence réseau.

### Pattern 3 : Auto-ajustement de contrainte

**Cas d'usage** : Contrainte dépendante d'une valeur calculée (taille max selon disponibilité).

**Code** :
```typescript
$effect(() => {
  if (validOptions.length > 0 && !validOptions.includes(selectedOption)) {
    selectedOption = validOptions[validOptions.length - 1]; // Prendre la plus grande valide
  }
});
```

**Alternative** : Désactiver le bouton d'action → UX moins bonne (utilisateur bloqué).

## Métriques 📊

| Métrique | Valeur |
|----------|--------|
| Temps d'implémentation | ~2h (setup + intégration) |
| Lignes de code (QuizSetup) | 364 lignes (dont 40 de doc) |
| Lignes de code (quiz-selection) | 176 lignes (dont 80 de doc) |
| Tests créés | 23 tests unitaires |
| Bugs trouvés en test manuel | 0 (code review a tout détecté avant) |

## Recommandations pour Futurs Projets 💡

1. **Toujours prévoir une phase de configuration** si l'action a des paramètres complexes ou multiples options
2. **Filtrage client quand < 100 items** : plus réactif que le serveur
3. **Tous les filtres actifs par défaut** (opt-out) sauf si cas spécifique justifie l'inverse
4. **Auto-ajuster les contraintes** plutôt que bloquer l'utilisateur
5. **localStorage pour reprise** : vérifier au `onMount` et proposer de reprendre
6. **Code review détecte les optimisations** : Map indexing, Fisher-Yates → avoir une checklist

## Tags

- `ux-pattern`
- `client-side-filtering`
- `quiz`
- `svelte-5`
- `configuration-page`

## Références

- ADR-006 : `adr-2026-02-06-political-quiz.md` (décision architecture)
- Pattern : `pattern-component-documentation.md` (documentation créée)
- Tests : `src/lib/utils/__tests__/quiz-selection.test.ts` (23 tests)

## Voir Aussi

- `lessons-learned-2026-02-01-phases-1-2.md` - Phases dans quiz scrutins
- `pattern-svelte-utils-extraction.md` - Extraction logique en utilitaires
- `ui-best-practices.md` - Standards UI du projet
