# Architecture : Quiz Politique Multi-Chambre (AN + PE)

## Date : 2026-02-06

## Principe

Zero duplication de code. Tout le quiz est factorisé dans des composants/helpers partagés.
Les routes AN et PE sont des wrappers de ~5 lignes passant une config chambre.

## QuizChamberConfig

```typescript
interface QuizChamberConfig {
	chamber: 'an' | 'pe';
	legislature: string; // '17' | 'PE-10'
	basePath: string; // '/an/quiz' | '/pe/quiz'
	lawBasePath: string; // '/an/laws' | '/pe/scrutins'
	chamberLabel: string;
	periodLabel: string;
	storageKey: string;
	sessionKey: string;
}
```

## Composants partagés

- `QuizPage.svelte` : page quiz entière (extraite de AN +page.svelte)
- `QuizResults.svelte` : page résultats entière (extraite de AN resultats/+page.svelte)
- `loadQuizData(legislature)` : helper serveur (extrait de AN +page.server.ts)

## Composants déjà réutilisables (inchangés)

- QuizSetup, LawDossierCard, QuizProgress, AlignmentPodium, GroupAlignmentCard

## Composants paramétrés

- VoteDetailModal : +prop lawBasePath
- quiz store : createQuizStore(config) avec storage keys dynamiques
- API group-votes : +param legislature dans le body

## Routes

- `/an/quiz` et `/pe/quiz` : `<QuizPage {data} config={X_QUIZ_CONFIG} />`
- `/an/quiz/resultats` et `/pe/quiz/resultats` : `<QuizResults config={X_QUIZ_CONFIG} />`
- `+page.server.ts` : `loadQuizData('17')` et `loadQuizData('PE-10')`

## ETL PE

- Fix `mapToScrutin()` pour `groupResults` depuis `stats.by_group`
- Nouveau `europarl/laws.ts` : import lois PE depuis HTV (is_main + procedure)
- Résoudre doublons groupes PE (hash courant vs historique)

## Plan d'implémentation

1. ETL (fix groupResults, import lois PE, dédup groupes)
2. Factorisation (extraire helpers, composants, paramétrer store/API)
3. Routes PE (wrappers légers)
4. Vérification
