# Fonctionnalité : Fiches thématiques

## Contexte

Actuellement NosElus organise l'information autour des entités "parlementaires" et "lois". Un citoyen lambda pense en termes de sujets du quotidien : le loyer, son salaire, sa retraite, sa santé. Cette fonctionnalité crée un troisième axe d'entrée : **le thème de vie**.

## Principe

Regrouper les votes parlementaires par grands sujets, avec pour chaque thème :

- Une synthèse en langage simple du bilan de chaque groupe politique
- Les scrutins les plus significatifs avec leur résultat
- Jamais de numéro de loi en premier plan

## Thèmes envisagés (premier niveau)

| Thème           | Exemples de scrutins couverts                    |
| --------------- | ------------------------------------------------ |
| Pouvoir d'achat | SMIC, inflation, taxes sur l'énergie             |
| Logement        | Encadrement des loyers, APL, expulsions          |
| Retraites       | Réforme 2023, âge légal, pénibilité              |
| Santé           | Déserts médicaux, remboursements, hôpital public |
| Immigration     | Lois asile, nationalité, régularisation          |
| Environnement   | ZFE, pesticides, énergies renouvelables          |
| Démocratie      | RIC, proportionnelle, transparence               |

## Structure d'une fiche thématique

```
[Thème : Pouvoir d'achat]

Ce que dit chaque groupe :
  - NFP : a voté POUR l'augmentation du SMIC dans 4 scrutins sur 4
  - RN : a voté CONTRE dans 3 scrutins sur 4, POUR dans 1
  - Ensemble : a voté CONTRE dans 2 scrutins, abstention dans 2
  ...

Scrutins clés :
  - 20/07/2022 — Proposition d'augmentation du SMIC à 1500€ net
    [voir le vote détaillé →]
  - 15/02/2023 — ...
```

## Approche technique

### Données

- Les scrutins existent déjà en base (table `scrutins` ou équivalent)
- Manque : un système de **tags thématiques** sur les scrutins/lois

### Tagger les scrutins

- Option A : tagging manuel éditorial (fiable mais lourd)
- Option B : tagging assisté par LLM sur le titre + description du scrutin
- Option C : tags issus de la classification de l'Assemblée Nationale (si disponible dans les données source)

### Pages à créer

- `/themes` — liste des thèmes
- `/themes/[slug]` — fiche d'un thème avec bilan par groupe + scrutins clés
- Composant réutilisable `VotingSummaryByGroup`

## État actuel

- Vérifier si les données de scrutins incluent déjà une classification thématique dans `src/routes/an/laws/`
- Vérifier la structure de la table `laws` dans `drizzle/migrations/`

## Prochaines étapes suggérées

1. Choisir 2-3 thèmes pilotes pour valider l'approche (ex: Pouvoir d'achat + Retraites)
2. Tagger manuellement ~20 scrutins emblématiques pour ces thèmes
3. Créer la page `/themes/[slug]` avec un design épuré
4. Mesurer l'engagement (temps passé, partages) avant d'élargir
