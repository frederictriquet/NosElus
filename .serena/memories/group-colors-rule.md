# Règle - Données des groupes et partis politiques

**IMPORTANT** : Les données des groupes et partis politiques ne doivent **JAMAIS** être hardcodées dans le code.

## Ce qui ne doit PAS être hardcodé

- **Noms** des groupes politiques (ex: "Rassemblement National", "La France Insoumise")
- **Noms** des partis
- **Abréviations/codes** des groupes (ex: "RN", "LFI", "PPE")
- **Couleurs** des groupes
- **Mappings** entre identifiants (ex: ParlTrack groupId → code interne)

## Règle

- Les couleurs doivent être récupérées dynamiquement depuis une source externe (API, données ouvertes)
- Elles doivent être stockées dans la base de données (colonne `color` de la table `organs`)
- Si aucune source de couleur n'est disponible, laisser `color: null` et les remplir manuellement ou via un script séparé

## Raisons

1. Les noms et codes peuvent changer au fil du temps
2. Ils varient selon les sources et les langues
3. Le hardcoding rend la maintenance difficile et introduit des erreurs
4. Les données doivent venir de la source de vérité (API, dumps de données)

## Approches acceptables

1. **Récupérer depuis la source** : API, dumps JSON, fichiers de données officiels
2. **Stocker en base de données** : Tables `organs` pour les groupes, avec noms et couleurs
3. **Scripts ETL séparés** : `etl-colors` pour synchroniser les couleurs manquantes
4. **Édition manuelle** : Via interface d'administration si nécessaire
5. **Hash pour les IDs** : Générer des IDs uniques via hash des identifiants sources (évite les mappings hardcodés)
6. **Laisser null** : Si une donnée n'est pas disponible dans la source, la laisser à null plutôt que d'inventer une valeur
