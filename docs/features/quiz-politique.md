# Quiz Politique - Documentation

## Vue d'ensemble

Le quiz politique permet aux citoyens de découvrir leur alignement avec les groupes parlementaires en votant sur de vraies lois. Disponible pour :
- **Assemblée nationale** : `/an/quiz`
- **Parlement européen** : `/pe/quiz`

## Architecture

### Composants partagés (multi-chambre)

L'architecture est **totalement factorisée** — zéro duplication de code entre AN et PE.

```
src/lib/
├── components/
│   ├── QuizPage.svelte         # Page quiz complète (partagée)
│   ├── QuizResults.svelte      # Page résultats (partagée)
│   ├── QuizSetup.svelte        # Config quiz (nb lois, tags)
│   ├── LawDossierCard.svelte   # Carte de loi + boutons vote
│   ├── QuizProgress.svelte     # Barre de progression
│   ├── AlignmentPodium.svelte  # Podium top 3 groupes
│   └── GroupAlignmentCard.svelte # Carte détail groupe
│
├── quiz/
│   └── config.ts               # Configuration AN_QUIZ_CONFIG / PE_QUIZ_CONFIG
│
├── server/quiz/
│   └── load-quiz-data.ts       # Helper serveur partagé
│
└── stores/
    └── quiz.ts                 # Store Svelte (localStorage)
```

### Routes

Les routes sont de simples wrappers (~10 lignes) passant une config chambre :

```typescript
// src/routes/pe/quiz/+page.svelte
<QuizPage config={PE_QUIZ_CONFIG} allLaws={data.allLaws} availableTags={data.availableTags} />

// src/routes/pe/quiz/+page.server.ts
export const load = async () => loadQuizData('PE-10');
```

### Configuration chambre

```typescript
interface QuizChamberConfig {
  chamber: 'an' | 'pe';
  legislature: string;        // '17' | 'PE-10'
  basePath: string;           // '/an/quiz' | '/pe/quiz'
  resultsPath: string;        // '/an/quiz/resultats' | '/pe/quiz/resultats'
  lawBasePath: string;        // '/an/laws' | '/pe/scrutins'
  chamberLabel: string;       // "l'Assemblée nationale" | "le Parlement européen"
  periodLabel: string;        // "législature 17" | "terme 10"
  storageKey: string;         // Clé localStorage pour votes
  sessionKey: string;         // Clé localStorage pour session
}
```

## Fonctionnement

### 1. Chargement des lois éligibles

**Server-side** (`load-quiz-data.ts`) :
- Récupère les lois avec résumé LLM + au moins 1 scrutin
- Charge les tags en batch (évite N+1 queries)
- Retourne `allLaws` + `availableTags`

**Client-side** (`quiz-selection.ts`) :
- Stratification par tags pour diversité thématique
- Mélange aléatoire (Fisher-Yates)
- Sélection de N lois pour le quiz
- Réserve de M lois pour remplacement si abstention

### 2. Progression du quiz

- **État** : Stocké dans Svelte store + localStorage
- **Navigation** : `QuizPage` affiche une loi à la fois
- **Votes** : Enregistrés dans `{ lawId, position: 'pour' | 'contre' }[]`
- **Abstention** : Tire une nouvelle loi de la réserve

### 3. Calcul d'alignement

**Algorithme Jaccard** (similarité simple) :
```typescript
alignmentScore = (votes_communs / total_votes) * 100
```

**Exemple** :
- User : [pour, contre, pour, contre, pour]
- Groupe A : [pour, contre, contre, contre, pour]
- Accord : 3/5 = **60%**

### 4. Affichage résultats

- **Podium** : Top 3 groupes visuellement mis en avant
- **Tableau** : Tous les groupes avec scores
- **Modal détail** : Clic sur groupe → détail vote par vote

## ETL PE (Parlement Européen)

### Import des lois PE

**Source** : HowTheyVote.eu API

```bash
# Import lois/procédures PE
make etl-europarl-laws

# Enrichissement textes (caches HTV + web scraping)
make etl-europarl-law-texts

# Génération résumés LLM
npm run etl:analyze-laws -- --legislature PE-10
```

**Fichiers** :
- `src/lib/server/etl/sources/europarl/laws.ts` - Import procédures depuis API HTV
- `src/lib/server/etl/sources/europarl/law-texts.ts` - Enrichissement descriptions
- `scripts/etl/enrich-europarl-law-texts.ts` - CLI enrichissement

### Sources d'enrichissement (priorité)

1. **OEIL Summary** (Legislative Observatory) - Résumé officiel structuré
2. **Press release** - Communiqué de presse du PE
3. **Snippet HTV** - Extrait court en cache
4. **Report/Resolution** - Texte légal complet (fallback)

Stratégie : combine toutes les sources disponibles, limite à 50 000 chars.

### Fix API legislature mismatch

**Problème** : Les groupes PE ont `legislature = '10'` (table `organs`) alors que scrutins/lois PE ont `legislature = 'PE-10'`.

**Solution** : Helper `getOrgansLegislature()` dans `config.ts` :
```typescript
// Convertit 'PE-10' → '10' pour requêtes sur organs
const organsLegislature = getOrgansLegislature(legislature);
```

## Tests

### Tests d'intégration

**API group-votes** (`src/routes/api/quiz/group-votes/group-votes.test.ts`) :
- 13 tests couvrant validation inputs, AN, PE, edge cases, performance
- Utilise la vraie DB (pattern `pattern-integration-tests-real-db`)

**ETL enrichment** (`src/lib/server/etl/sources/europarl/__tests__/enrichment.test.ts`) :
- 11 tests validant descriptions enrichies > 500 chars
- Vérifie lois PE spécifiques (A10-0215, A9-0048, A9-0355)
- Qualité : pas de HTML, contenu lisible, structuré

### Tests E2E

**Playwright** (`tests/e2e/quiz-pe.test.ts`) :
- 15 tests du parcours complet : intro → vote → résultats → restart
- Skippés en CI (nécessitent DB), à exécuter localement

```bash
# Exécuter les tests E2E
npm run test:e2e -- quiz-pe.test.ts
```

## Utilisation

### Pour l'utilisateur

1. Accéder à `/an/quiz` ou `/pe/quiz`
2. Configurer le quiz (optionnel) : nombre de lois, filtres tags
3. Voter pour/contre sur chaque loi présentée
4. Voir les résultats d'alignement avec les groupes
5. Cliquer sur un groupe pour détail vote par vote

### Pour le développeur

#### Ajouter une nouvelle chambre

1. Créer la config dans `src/lib/quiz/config.ts` :
```typescript
export const SENAT_QUIZ_CONFIG: QuizChamberConfig = {
  chamber: 'senat',
  legislature: 'S2024',
  // ...
};
```

2. Créer les routes :
```svelte
<!-- src/routes/senat/quiz/+page.svelte -->
<QuizPage config={SENAT_QUIZ_CONFIG} {data} />
```

3. Load data :
```typescript
// src/routes/senat/quiz/+page.server.ts
export const load = async () => loadQuizData('S2024');
```

C'est tout ! Zéro duplication de code.

#### Modifier l'algorithme d'alignement

Fichier : `src/lib/utils/alignment.ts`

```typescript
export function calculateAlignment(
  userVotes: Vote[],
  groupVotes: Vote[]
): number {
  // Implémenter nouvelle formule ici
}
```

## Limitations connues

### v1 (actuelle)

- **Pas de multi-device** : localStorage non synchronisé entre appareils
- **Perte si clear data** : Effacement localStorage = perte résultats
- **Jaccard simpliste** : Toutes les lois ont le même poids
- **Pas de partage** : Impossible de partager ses résultats

### Améliorations futures

- **v2** : Authentification optionnelle → sauvegarde cloud
- **v3** : Pondération des lois par importance
- **v4** : Comparaison multi-législatures

## Références

### ADR et architecture

- `arch-2026-02-06-pe-quiz.md` - Architecture multi-chambre
- `adr-2026-02-06-political-quiz.md` - Décision quiz politique (complet)

### Patterns appliqués

- `pattern-batch-loading-n-plus-one.md` - Évite N+1 sur tags
- `pattern-client-side-stratification.md` - Sélection lois client
- `pattern-integration-tests-real-db.md` - Tests avec vraie DB
- `pattern-quiz-tests.md` - Patterns de test quiz

### Documentation externe

- [Jaccard Similarity](https://en.wikipedia.org/wiki/Jaccard_index)
- [SvelteKit Routing](https://kit.svelte.dev/docs/routing)
- [HowTheyVote.eu API](https://howtheyvote.eu/api/docs)

## Maintenance

### Ajouter de nouvelles lois

Les lois sont ajoutées automatiquement via ETL :

```bash
# AN : lois déjà importées automatiquement
make etl-an-laws

# PE : import manuel
make etl-europarl-laws
make etl-europarl-law-texts
npm run etl:analyze-laws -- --legislature PE-10
```

### Mettre à jour les résumés

```bash
# Regénérer tous les résumés d'une législature
npm run etl:analyze-laws -- --legislature PE-10 --force
```

### Debugging

**Votes non trouvés** :
- Vérifier que `scrutins.groupResults` est non NULL
- Vérifier le mapping legislature (PE-10 vs 10)

**Lois manquantes** :
- Vérifier existence de `law_summaries` (requis pour éligibilité)
- Vérifier qu'il y a au moins 1 scrutin lié

**Score d'alignement incorrect** :
- Inspecter localStorage : `noselus-quiz-pe-votes`
- Vérifier l'API `/api/quiz/group-votes` retourne les bons groupResults
