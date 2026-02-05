# Leçons apprises - Migration PE Positions vers DB

## Date : 2026-02-05

## Contexte
Migration des positions politiques hardcodées des groupes PE (`EU_GROUP_POSITIONS`) vers la base de données, conformément à `no-hardcoding-rule`.

## Leçons

### 1. Effet de bord entre scripts ETL
**Problème** : En ajoutant un check `organ.politicalPosition` dans `determinePosition()`, le script `import-political-positions.ts` devenait incapable de recalculer les positions ParlGov pour les groupes déjà seedés.

**Cause racine** : `determinePosition()` est une fonction de calcul ETL, pas une fonction applicative. Elle ne devrait pas lire l'état DB.

**Solution** : 
- Garder `determinePosition()` comme fonction pure de calcul ParlGov
- Protéger `import-political-positions.ts` : ne pas écraser les positions seedées quand pas de match ParlGov
- Les positions DB sont lues par les queries applicatives, pas par la fonction ETL

**Règle** : Les fonctions de calcul ETL doivent rester pures. La logique de "ne pas écraser" appartient au script appelant, pas à la fonction de calcul.

### 2. Workflow skills : respecter les étapes
**Problème** : Après `/implement`, un commit a été proposé directement, sans passer par `/test-run` et `/code-review`.

**Solution** : Règle stricte ajoutée dans `pattern-workflow-skills-orchestration` : les commits ne se font que pendant `/pre-merge`.

### 3. `.PHONY` oublié dans le Makefile
**Problème** : Le nouveau target `etl-seed-pe-positions` n'était pas dans `.PHONY`.

**Règle** : Toujours vérifier `.PHONY` quand on ajoute un target. La rule `etl-makefile-rule` le mentionne mais c'est facile à oublier.

### 4. Constante deprecated vs supprimée
**Problème** : Hésitation entre garder `EU_GROUP_POSITIONS` avec `@deprecated` ou la supprimer.

**Décision** : Suppression complète. Le critère de succès était clair ("n'existe plus dans le code") et les données sont en DB. Un fallback `@deprecated` crée de la confusion et viole l'esprit de `no-hardcoding-rule`.

## Pattern réutilisable
Pour migrer des données hardcodées vers la DB :
1. Créer un script de seed idempotent (pattern: `import-external-colors.ts`)
2. Protéger le script d'import existant contre l'écrasement des données seedées
3. Supprimer la constante hardcodée (pas de `@deprecated` intermédiaire)
4. Mettre à jour la documentation
