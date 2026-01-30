# Requêter la base de données PostgreSQL

## Commande pour exécuter des requêtes SQL

```bash
docker exec noselus-postgres psql -U noselus -d noselus -c "VOTRE_REQUETE_SQL"
```

## Informations de connexion

- **Container**: `noselus-postgres`
- **User**: `noselus`
- **Password**: `noselus`
- **Database**: `noselus`
- **Port**: `5432`

## Exemples utiles

### Compter les votes par groupe pour un député
```bash
docker exec noselus-postgres psql -U noselus -d noselus -c "
SELECT v.group_id, o.short_name, COUNT(*) as vote_count
FROM votes v
LEFT JOIN organs o ON v.group_id = o.id
WHERE v.actor_id = 'PA1206'
GROUP BY v.group_id, o.short_name
ORDER BY vote_count DESC;
"
```

### Statistiques des tables
```bash
docker exec noselus-postgres psql -U noselus -d noselus -c "
SELECT 'actors' as table_name, COUNT(*) FROM actors
UNION ALL SELECT 'organs', COUNT(*) FROM organs
UNION ALL SELECT 'votes', COUNT(*) FROM votes
UNION ALL SELECT 'scrutins', COUNT(*) FROM scrutins;
"
```

## Notes

- Ne PAS utiliser `docker compose exec db` car cela peut échouer avec des erreurs de variables d'environnement
- Utiliser directement `docker exec noselus-postgres` avec le nom du conteneur
