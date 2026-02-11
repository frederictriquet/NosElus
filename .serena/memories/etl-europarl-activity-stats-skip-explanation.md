# ETL Europarl Activity Stats — 166 MEPs skippés

## Constat

`make etl-europarl-activity-stats` traite 303 MEPs mais n'insère des stats que pour ~137 d'entre eux.
Les 166 restants sont skippés.

## Cause

La source de données est l'API **HowTheyVote** (`https://howtheyvote.eu/api`).
Cette API ne couvre que les législatures récentes du Parlement européen.

Les 166 MEPs skippés sont des **anciens eurodéputés** (Nicole Fontaine, Jean-Marie Le Pen, Yves Cochet, etc.)
pour lesquels l'API retourne `total: 0` votes.

Le code skip correctement ces cas (dans `importEuroparlActivityStats`) :

- Si `voteStats` est null (erreur API) → skip
- Si `voteStats.totalVotes === 0` (pas de données) → skip

## Conclusion

Ce comportement est **normal et attendu**. Le ratio ~137/303 correspond aux MEPs
pour lesquels HowTheyVote dispose effectivement de données de votes.
