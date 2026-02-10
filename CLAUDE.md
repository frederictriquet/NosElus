# Instructions système du dépôt

Ce fichier définit des règles IMPÉRATIVES.
Toute solution qui ne respecte pas ces règles est incorrecte.

## Base de données PostgreSQL

### ⛔ Interdictions absolues

Il est STRICTEMENT INTERDIT :

- d’utiliser `docker exec`
- d’utiliser `docker compose exec`
- d’utiliser toute commande Docker directe pour accéder à PostgreSQL
- d’exécuter `psql` directement depuis Docker ou le host

Toute commande ou solution impliquant Docker pour la base de données est FAUSSE,
même si elle fonctionne techniquement.

### ✅ Méthode unique autorisée

La SEULE interface valide pour toute interaction avec PostgreSQL est :

```bash
./scripts/db-query.sh "VOTRE_REQUETE_SQL"
```

Aucune autre méthode n’est acceptable.

## RÈGLE DE RAISONNEMENT OBLIGATOIRE

Si une solution envisagée implique Docker pour la DB :
→ elle doit être rejetée
→ chercher une solution utilisant exclusivement ./scripts/db-query.sh

PORTÉE DES RÈGLES

Ces règles s’appliquent :

- en mode debug
- en exploration
- en refactor
- avec ou sans agent
- même si une autre solution semble plus simple ou plus rapide
