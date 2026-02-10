# Pattern : Workflow Skills Orchestré

## Date : 2026-02-01

## Problème

Lors du développement d'une feature complexe, il est facile de perdre le fil, d'oublier des étapes importantes (tests, review, documentation), ou de livrer du code non testé.

## Contexte

Développement de fonctionnalités multi-étapes nécessitant analyse, architecture, implémentation, tests, review et documentation.

## Solution

Utiliser un workflow séquentiel de skills spécialisées qui se suivent logiquement :

```
/analyze → /architecture → /implement → /test-write → /test-run → /code-review → /pre-merge → /roadmap-update → /capitalize
```

Chaque skill a une responsabilité unique et produit des artefacts consommés par les suivantes.

## Workflow Détaillé

### Phase 1 : Compréhension

1. **`/analyze`** - Analyse approfondie du besoin
   - Produit : memories d'analyse
   - Sortie : Compréhension claire du problème

### Phase 2 : Conception

2. **`/architecture`** - Conception de la solution
   - Produit : memories d'architecture
   - Sortie : Plan d'implémentation détaillé

### Phase 3 : Développement

3. **`/implement`** - Implémentation du code
   - Produit : Code fonctionnel
   - Sortie : Feature implémentée

### Phase 4 : Validation

4. **`/test-write`** - Écriture des tests
   - Produit : Suite de tests
   - Sortie : Tests couvrant tous les cas

5. **`/test-run`** - Exécution et validation
   - Produit : Rapport de tests
   - Sortie : Validation de la qualité

### Phase 5 : Review

6. **`/code-review`** - Revue de code approfondie
   - Produit : Feedback et corrections
   - Sortie : Code revu et amélioré

### Phase 6 : Livraison

7. **`/pre-merge`** - Préparation au merge
   - Produit : PR prête
   - Sortie : Branche validée

8. **`/roadmap-update`** - Mise à jour de la roadmap
   - Produit : Roadmap à jour
   - Sortie : Traçabilité complète

9. **`/capitalize`** - Capitalisation des apprentissages
   - Produit : Memories de patterns/ADR
   - Sortie : Connaissances réutilisables

## Exemple Concret : Phase 2.2

```
Session complète (2026-02-01) :

1. /analyze "Phase 2.2 Implication individuelle"
   → Identifie besoin de cosignataires + UI

2. /architecture
   → Design helpers + tables + UI

3. /implement
   → Helpers getActorLawsImplication() et getLawContributors()
   → UI deputy page et law page

4. /test-write
   → 11 tests d'intégration

5. /test-run
   → 24/24 tests passent (100%)

6. /code-review
   → 3 suggestions mineures appliquées

7. /pre-merge
   → Branche pushée, PR description prête

8. /roadmap-update --done "Phase 2.2"
   → ROADMAP2.md mis à jour

9. /capitalize
   → Documentation de ce pattern !
```

## Avantages

- ✅ **Aucune étape oubliée** : Le workflow guide naturellement
- ✅ **Qualité garantie** : Tests et review systématiques
- ✅ **Traçabilité** : Toutes les décisions documentées
- ✅ **Réutilisabilité** : Memories SERENA capitalisées
- ✅ **Progressivité** : Chaque skill construit sur la précédente

## Inconvénients

- ⚠️ Plus long initialement (mais évite la dette technique)
- ⚠️ Nécessite discipline (ne pas sauter d'étapes)

## Skill /next : Continuité

La skill `/next` permet de reprendre le workflow après interruption en rappelant :

- Où on en est
- Quelle skill a été exécutée en dernier
- Quelle est la prochaine étape logique

## RÈGLE STRICTE : Pas de Commit Avant /pre-merge

**INTERDICTION ABSOLUE** de proposer un commit, un push ou un merge tant que les étapes suivantes ne sont pas complétées dans l'ordre :

1. `/test-write` ou `/test-run` — Les tests DOIVENT être exécutés après /implement
2. `/code-review` — Le code DOIT être revu
3. `/pre-merge` — C'est LA SEULE étape où le commit est créé

**Après /implement**, la SEULE action suivante est de proposer `/test-run` (ou `/test-write` si des tests manquent). Ne JAMAIS résumer les changements en proposant un commit.

**Motif** : Session 2026-02-05, migration PE positions — commit proposé après /implement, avant tests et review. Le workflow n'aurait pas été respecté sans intervention de l'utilisateur.

## Anti-Pattern à Éviter

❌ **"Tout d'un coup"** : Coder directement sans analyse ni architecture
❌ **"Tests après coup"** : Ajouter les tests uniquement si demandé
❌ **"Review optionnelle"** : Merger sans relecture
❌ **"Documentation si temps"** : Ne jamais documenter
❌ **"Commit prématuré"** : Proposer un commit après /implement sans passer par /test et /code-review

## Métriques de Succès

| Indicateur             | Session Phase 2.2 |
| ---------------------- | ----------------- |
| Tests écrits           | ✅ 11 tests       |
| Tests passants         | ✅ 100%           |
| Code review fait       | ✅ Oui            |
| Suggestions appliquées | ✅ 3/3            |
| Roadmap à jour         | ✅ Oui            |
| Memories capitalisées  | ✅ 20+            |

## Références

- ROADMAP2.md : Phases 1.1, 1.2, 2.1, 2.2 complétées avec ce workflow
- Commits : 51 commits propres et incrémentaux
- Tests : 0 régression, 24/24 tests passent
