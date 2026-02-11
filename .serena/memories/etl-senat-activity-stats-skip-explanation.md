# ETL Senat Activity Stats — seulement 700/1943 sénateurs traités

## Constat

`make etl-senat-activity-stats` ne traite que ~700 sénateurs sur les 1943 présents en base.

## Cause

La source de données est l'API du Sénat (`https://www.senat.fr/calendrier_activite/json/liste_actifs.json`).
Cette API retourne uniquement les sénateurs disposant de données d'activité, soit **700 entrées**
(après filtrage de la ligne d'en-tête).

La base `actors WHERE chamber = 'SENAT'` contient **1943 sénateurs**, incluant tous les sénateurs
historiques importés (anciens mandats, sénateurs décédés, etc.).

Le script :

1. Récupère les 700 sénateurs depuis l'API du Sénat
2. Filtre ceux ayant `evtPlusRecent` (activité récente) → 700
3. Tente de matcher chaque matricule avec un acteur en base
4. Récupère les données d'activité pour ceux trouvés

Les ~1243 sénateurs restants sont des **sénateurs historiques** absents de l'API d'activité du Sénat.

## Conclusion

Ce comportement est **normal et attendu**. Le ratio ~700/1943 correspond aux sénateurs
pour lesquels le Sénat fournit des données d'activité.
Même pattern que l'ETL europarl-activity-stats (voir `etl-europarl-activity-stats-skip-explanation`).
