# Quiz Politique - Découvrez votre alignement parlementaire

Interface permettant aux citoyens de voter sur de vraies lois de l'Assemblée nationale et de découvrir leur alignement avec les groupes parlementaires.

## Vue d'ensemble

Le module quiz politique permet aux utilisateurs de :
1. **Configurer** leur quiz en sélectionnant des thèmes et un nombre de questions
2. **Voter** "pour" ou "contre" sur des lois réelles (avec option "passer")
3. **Découvrir** leur alignement avec les groupes via un score de similarité (Jaccard)

### Cas d'usage principaux

| Cas | Description |
|-----|-------------|
| Découverte citoyenne | Comprendre sa position politique sur des lois concrètes |
| Éducation civique | Visualiser comment les groupes votent sur différents thèmes |
| Comparaison | Identifier les groupes les plus alignés avec ses valeurs |

## Architecture

### Flux utilisateur

```
┌────────────┐    ┌──────────┐    ┌───────────┐
│   Setup    │ -> │   Quiz   │ -> │ Résultats │
│ (config)   │    │ (votes)  │    │ (scores)  │
└────────────┘    └──────────┘    └───────────┘
     │                 │                 │
     v                 v                 v
  Tags +           20 lois           Podium +
  Taille         Pour/Contre         Tableau +
                  Abstention          Modal
```

### Fichiers

| Fichier | Responsabilité |
|---------|----------------|
| **Routes** | |
| `+page.server.ts` | Charge toutes les lois éligibles + tags avec compteurs |
| `+page.svelte` | Orchestration phases setup/quiz, navigation, debug panel |
| `resultats/+page.svelte` | Calcul et affichage des résultats d'alignement |
| **Composants** | |
| `QuizSetup.svelte` | Interface de configuration (tags, taille) |
| `QuizProgress.svelte` | Barre de progression visuelle |
| `AlignmentPodium.svelte` | Podium top 3 des résultats |
| `VoteDetailModal.svelte` | Modal détail accords/désaccords par loi |
| **Utilitaires** | |
| `quiz-selection.ts` | Filtrage et stratification client des lois |
| `alignment.ts` | Calcul de similarité (Jaccard) et tri des résultats |
| **Store** | |
| `quiz.ts` | État global : votes, lois, index, localStorage |
| **API** | |
| `api/quiz/group-votes/+server.ts` | Votes des groupes pour les lois sélectionnées |

### Séparation des responsabilités

**Serveur** (`+page.server.ts`) :
- Requête DB : lois éligibles (≥1 scrutin, legislature 17, avec résumé IA)
- Requête DB : tags disponibles avec compteurs
- Enrichissement : association lois ↔ tags
- **PAS de stratification** (déléguée au client)

**Client** (`quiz-selection.ts`) :
- Filtrage par tags sélectionnés (logique OR)
- Stratification par tag principal (échantillonnage équitable)
- Shuffle Fisher-Yates (distribution uniforme)
- Split quiz/réserve

**Store** (`quiz.ts`) :
- Persistance localStorage (`noselus-quiz-votes`)
- Navigation (next, previous, abstain)
- Validation (canGoNext, canAbstain)
- Completion tracking

## Installation

Module interne au projet NosÉlus. Aucune installation séparée requise.

### Dépendances

- SvelteKit 2.x (routage, SSR)
- Svelte 5.x (runes)
- Drizzle ORM (requêtes DB)
- LayerCake (graphiques dans résultats - via AlignmentPodium)

## Utilisation

### 1. Page de configuration

**Route** : `/an/quiz`

L'utilisateur arrive sur la page de setup (si aucun quiz en cours dans localStorage).

```svelte
<QuizSetup
  availableTags={data.availableTags}
  allLaws={data.allLaws}
  onStart={(selectedTags, quizSize) => {
    const { quizLaws, reserveLaws } = selectQuizLaws(data.allLaws, selectedTags, quizSize);
    quizStore.init(quizLaws, reserveLaws);
    phase = 'quiz';
  }}
/>
```

**Fonctionnalités** :
- Tous les tags cochés par défaut
- Compteur temps réel : "X lois disponibles"
- Boutons [5] [10] [15] [20] dynamiquement bornés
- Bouton "Commencer" désactivé si 0 tag sélectionné

### 2. Phase quiz

Après avoir cliqué "Commencer", l'utilisateur vote sur chaque loi.

**Composants affichés** :
```svelte
<QuizProgress current={currentIndex} total={quizLawCount} />

<div class="vote-panel">
  <button class="vote-pour" onclick={() => quizStore.vote('pour')}>Pour</button>
  <button class="vote-contre" onclick={() => quizStore.vote('contre')}>Contre</button>

  <button class="abstain-btn" onclick={() => quizStore.abstain()}>
    Passer cette question
    <span class="reserve-badge">{$reserveCount} restantes</span>
  </button>
</div>

<LawDossierCard law={currentLaw} showDisclaimer={false} />
```

**Navigation** :
- Précédent (désactivé si index = 0)
- Suivant (activé après vote, texte "Voir les résultats" à la dernière question)
- Passer (remplace par une loi de réserve si disponible)

**Persistance** :
- Chaque vote est sauvegardé dans localStorage
- Rechargement de page → reprise du quiz au même index

### 3. Page résultats

**Route** : `/an/quiz/resultats`

Affiche l'alignement avec chaque groupe parlementaire.

**Calcul** :
```typescript
// Jaccard similarity
score = (accords / (accords + désaccords)) * 100

// Exemple : 8 accords, 2 désaccords → 80%
```

**Composants** :
- `AlignmentPodium` : Top 3 avec visualisation
- Tableau complet : tous les groupes triés par score
- `VoteDetailModal` (au clic) : détail loi par loi avec liens `/an/laws/{id}`

**Actions** :
- Bouton "Recommencer" : efface localStorage et retourne au setup

## API

### GET `/api/quiz/group-votes`

Retourne les votes des groupes pour une liste de lois.

**Request** :
```json
POST /api/quiz/group-votes
{
  "lawIds": ["TXT123", "TXT456", ...]
}
```

**Response** :
```json
{
  "groupVotes": {
    "PO123456": {
      "TXT123": {
        "majorityPosition": "pour",
        "pour": 45,
        "contre": 12
      },
      ...
    },
    ...
  },
  "groups": [
    {
      "id": "PO123456",
      "name": "La France insoumise - Nouveau Front populaire",
      "shortName": "LFI-NFP"
    },
    ...
  ]
}
```

## Configuration

### Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `DATABASE_URL` | ✅ | URL PostgreSQL pour les requêtes de lois et scrutins |

### Constantes configurables

**`quiz-selection.ts`** :
```typescript
const QUIZ_SIZES = [5, 10, 15, 20]; // Tailles proposées
```

**`+page.server.ts`** :
```typescript
const MIN_SCRUTINS = 1;      // Nombre min de scrutins par loi éligible
const LEGISLATURE = '17';    // Législature courante
```

## Tests

### Tests unitaires

```bash
# Tests du module quiz-selection
npm test src/lib/utils/__tests__/quiz-selection.test.ts

# Tests de l'alignement (Jaccard)
npm test src/lib/utils/political-spectrum.test.ts
```

**Couverture** :
- `quiz-selection.ts` : 23 tests (filtrage, stratification, split, edge cases, randomisation)
- `alignment.ts` : 24 tests (Jaccard, tri, podium, cas limites)

### Tests manuels

Checklist disponible : `/tmp/test-checklist.md` (généré pendant le développement)

**Phases à tester** :
1. Setup : tags, tailles, filtrage temps réel
2. Quiz : navigation, votes, abstention, réserve
3. Résultats : podium, tableau, modal, liens
4. Responsive : mobile (375px), tablet (768px)
5. Cas limites : 0 tags, 5 lois, 20+ lois
6. Edge cases : localStorage corrompu, pas de données

## Personnalisation

### CSS Variables

Les composants du quiz utilisent les variables CSS globales du projet :

```css
:root {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-surface: #ffffff;
  --color-bg: #f9fafb;
  --color-border: #e5e7eb;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --radius: 0.5rem;
  --radius-lg: 0.75rem;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

### Couleurs de vote

**Vote "Pour"** : `#10b981` (vert)
**Vote "Contre"** : `#ef4444` (rouge)

Définies dans `+page.svelte` (styles `.vote-pour`, `.vote-contre`).

### Tailles de quiz

Modifier `QUIZ_SIZES` dans `quiz-selection.ts` pour changer les options proposées.

## Standards du Projet

- [x] Documentation JSDoc complète (interfaces, fonctions publiques)
- [x] Tests unitaires avec factory pattern
- [x] Composants Svelte 5 avec runes (`$state`, `$derived`, `$effect`)
- [x] Persistance localStorage pour reprise
- [x] Responsive (mobile-first)
- [x] Accessibilité (roles, aria-labels, keyboard navigation)
- [x] CSP-compliant (nonces pour inline styles)
- [x] French UTF-8 content

## Cas d'Usage Réels

### Pages utilisant ce module

| Page | Description |
|------|-------------|
| `/an/quiz` | Point d'entrée : setup ou reprise de quiz |
| `/an/quiz/resultats` | Affichage et analyse des résultats |

### Intégration navigation

Le quiz est accessible depuis la navigation principale de l'Assemblée nationale :

```svelte
<!-- src/routes/an/+layout.svelte -->
<nav>
  <a href="/an">Accueil</a>
  <a href="/an/elus">Députés</a>
  <a href="/an/quiz">Quiz Politique</a> <!-- ← Nouveau -->
</nav>
```

## Évolutions Possibles

- [ ] Ajouter un mode "marathon" (toutes les lois disponibles)
- [ ] Permettre de sauvegarder/partager ses résultats (URL avec hash)
- [ ] Comparer deux quiz dans le temps (évolution de l'alignement)
- [ ] Ajouter des filtres avancés (date, type de loi, statut)
- [ ] Mode "challenge" : deviner le vote du groupe avant de voir la réponse
- [ ] Export PDF des résultats
- [ ] Graphiques d'évolution de l'alignement (si plusieurs quiz)

## Dépannage

### Problème 1 : Setup immédiatement remplacé par quiz

**Cause** : localStorage contient un quiz en cours (clé `noselus-quiz-votes`)

**Solution** :
```javascript
// Dans la console du navigateur
localStorage.removeItem('noselus-quiz-votes');
location.reload();
```

### Problème 2 : Aucune loi disponible

**Cause** :
- Base de données vide pour legislature 17
- Aucune loi avec ≥1 scrutin
- Problème de connexion DB

**Solution** :
```bash
# Vérifier la base de données
./scripts/db-query.sh "SELECT COUNT(*) FROM laws WHERE legislature = '17';"

# Vérifier les lois avec scrutins
./scripts/db-query.sh "
  SELECT l.id, l.title, COUNT(DISTINCT s.id) as scrutin_count
  FROM laws l
  LEFT JOIN scrutins s ON l.id = s.law_id
  WHERE l.legislature = '17'
  GROUP BY l.id, l.title
  HAVING COUNT(DISTINCT s.id) >= 1;
"
```

### Problème 3 : Bouton "Commencer" toujours désactivé

**Cause** :
- Aucun tag sélectionné
- Bug dans le calcul de `filteredLawCount`

**Solution** :
1. Cliquer sur "Tout cocher" pour sélectionner tous les tags
2. Vérifier que le compteur affiche "X lois disponibles" (X > 0)
3. Si le problème persiste, vérifier la console pour erreurs JS

### Problème 4 : Modal de détail ne s'ouvre pas

**Cause** : Erreur dans `calculateDetailedAlignment` ou données manquantes

**Solution** :
```typescript
// Vérifier dans la console
console.log(result); // Doit contenir { details: [...] }
```

## Références

### Documentation externe

- [Algorithme de Jaccard](https://en.wikipedia.org/wiki/Jaccard_index) - Mesure de similarité
- [Fisher-Yates Shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) - Mélange uniforme
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes) - $state, $derived, $effect

### ADRs liés

- `adr-2026-02-06-political-quiz.md` - Décision d'architecture du quiz
- `adr-2026-02-01-scrutin-category.md` - Catégorisation des scrutins
- `adr-2026-02-04-political-positioning-automation.md` - Positionnement politique

### Patterns SERENA

- `pattern-component-documentation.md` - Standards de documentation
- `pattern-test-fixtures-factories.md` - Factory pattern pour tests
- `std-reusable-components.md` - Composants réutilisables
- `ui-best-practices.md` - Bonnes pratiques UI

## Changelog

| Version | Date | Changements |
|---------|------|-------------|
| 1.0.0 | 2026-02-06 | Création initiale du module quiz politique |
| | | - Page de configuration avec sélection tags + taille |
| | | - Phase quiz avec navigation et abstention |
| | | - Résultats avec podium et modal détail |
| | | - Persistance localStorage |
| | | - 23 tests unitaires (quiz-selection) |
| | | - Fisher-Yates shuffle pour distribution uniforme |
| | | - Map indexing pour performance (O(n) tags) |
| | | - Mobile responsive order fixing |

## License

Projet NosÉlus - Usage interne
