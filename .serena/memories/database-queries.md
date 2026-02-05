# Accès PostgreSQL – RÈGLE IMPÉRATIVE

## ⛔ INTERDICTION ABSOLUE
Il est STRICTEMENT INTERDIT d’utiliser :
- `docker exec`
- `docker compose exec`
- toute commande Docker directe pour PostgreSQL

Toute solution utilisant Docker pour accéder à la DB est INCORRECTE.

## ✅ MÉTHODE UNIQUE AUTORISÉE
La seule méthode valide pour exécuter des requêtes SQL est :

```bash
./scripts/db-query.sh "VOTRE_REQUETE_SQL"
```

Aucune autre méthode n’est acceptable.


⚠️ Oui, même **retirer `docker exec` de SERENA** est volontaire et nécessaire.

---

## 4️⃣ Ajouter `CLAUDE.md` (ce qui verrouille vraiment)

À la racine du repo :

```md
## Règles système – Base de données

- NE JAMAIS utiliser `docker exec` ou `docker compose exec` pour PostgreSQL
- Toute commande Docker directe pour la DB est invalide
- La seule interface autorisée est :
  ./scripts/db-query.sh

Si une solution implique Docker pour la DB, elle est fausse.







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

## Requêtes de Mandats : RÈGLE CRITIQUE

**⚠️ Toute requête récupérant des mandats DOIT être ordonnée par `startDate DESC`**

### Pattern obligatoire
```typescript
const mandatesData = await db
  .select({
    actorId: mandates.actorId,
    // ... autres colonnes
    startDate: mandates.startDate  // ← Obligatoire pour le tri
  })
  .from(mandates)
  .where(/* conditions */)
  .orderBy(desc(mandates.startDate));  // ← OBLIGATOIRE
```

### Justification
Un acteur peut avoir plusieurs mandats successifs dans différents groupes. Sans ordre :
- La base retourne un mandat **arbitraire**
- Risque d'afficher un groupe obsolète au lieu du groupe actuel
- Incohérence entre pages (liste vs profil)

### Exemple de bug sans ordering
Deputy PA841067 avait 4 mandats GP :
- 2024-07-19 : Non inscrit (NI)
- 2024-08-06 : À Droite (AD)
- 2024-09-17 : UDR (nom court uniquement)
- 2024-09-17 : Union des droites pour la République (UDR avec nom complet)

Sans `.orderBy()`, la requête pouvait retourner le 3e mandat au lieu du 4e, affichant "UDR" au lieu de "Union des droites pour la République".

**Fix** : `.orderBy(desc(mandates.startDate))` garantit que le mandat le plus récent est utilisé.

Voir : `bug-2026-02-01-unordered-mandate-query.md` pour détails complets.

## Notes

- Ne PAS utiliser `docker compose exec db` car cela peut échouer avec des erreurs de variables d'environnement
- Utiliser directement `docker exec noselus-postgres` avec le nom du conteneur
