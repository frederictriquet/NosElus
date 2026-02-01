# Bug : Requêtes de Mandates Non Ordonnées Retournant le Mauvais Groupe

## Date
2026-02-01

## Symptômes

Sur la page liste des députés (`/an/deputes`), un député (PA841067) affichait un nom de groupe incomplet :
- **Affiché** : "UDR" (short + full identiques)
- **Attendu** : "Union des droites pour la République"

Sur la page de profil du même député (`/an/deputes/PA841067`), le nom complet était correct.

## Cause Racine

Les requêtes récupérant les groupes parlementaires des députés **n'étaient pas ordonnées** par date de mandat.

```typescript
// ❌ Code buggy - sans ordre
const groupsData = await db
  .select({
    actorId: mandates.actorId,
    groupId: organs.id,
    groupName: organs.name,
    groupShortName: organs.shortName,
    groupColor: organs.color
  })
  .from(mandates)
  .innerJoin(organs, eq(mandates.organId, organs.id))
  .where(sql`${mandates.actorId} IN ${deputyIds} AND ${organs.type} = 'GP'`)
  // ⚠️ Pas de .orderBy() !
```

Le député avait **plusieurs mandats de groupe** dans la base :
```sql
PA841067 - Mandates:
- PO840056 | Non inscrit       | NI  | 2024-07-19
- PO845520 | À Droite          | AD  | 2024-08-06  
- PO847173 | UDR               | UDR | 2024-09-17
- PO872880 | Union des droites pour la République | UDR | 2024-09-17
```

Sans ordre, la base retournait un mandat **arbitraire** (souvent le premier inséré). Le code prenait le premier mandat trouvé via :

```typescript
for (const g of groupsData) {
  if (!groupByActor.has(g.actorId) && g.groupId) {
    groupByActor.set(g.actorId, { ... }); // Premier wins
  }
}
```

Résultat : Si PO847173 (UDR sans nom long) arrivait avant PO872880, le nom complet n'apparaissait pas.

## Chemin de Diagnostic

### 1. Comparaison page liste vs page profil
- **Observation** : Le nom complet apparaît sur `/an/deputes/PA841067` mais pas sur `/an/deputes`
- **Hypothèse** : Les deux pages utilisent des requêtes différentes

### 2. Investigation dans la base de données
```bash
# Requête pour voir les mandats du député
psql -d noselus -c "
  SELECT m.actor_id, o.id, o.name, o.short_name, m.start_date 
  FROM mandates m 
  JOIN organs o ON m.organ_id = o.id 
  WHERE m.actor_id = 'PA841067' AND o.type = 'GP'
  ORDER BY m.start_date;
"
```

- **Résultat** : 4 mandats trouvés, dont 2 avec shortName="UDR" mais noms différents
- **Conclusion** : Groupe le plus récent a le bon nom complet

### 3. Analyse du code
- Lecture de `/an/deputes/+page.server.ts` ligne 69-83
- Constatation : Pas de `orderBy()` dans la requête
- Vérification : `/an/deputes/+server.ts` a le même problème

### 4. Fix et validation
- Ajout de `.orderBy(desc(mandates.startDate))`
- Ajout de `startDate: mandates.startDate` dans le SELECT
- Test sur le navigateur : Nom complet apparaît correctement

## Solution

Ajouter un tri par `startDate DESC` pour récupérer le mandat **le plus récent** en premier :

```typescript
// ✅ Code corrigé - avec ordre
const groupsData = await db
  .select({
    actorId: mandates.actorId,
    groupId: organs.id,
    groupName: organs.name,
    groupShortName: organs.shortName,
    groupColor: organs.color,
    startDate: mandates.startDate  // ← Ajouté pour permettre le tri
  })
  .from(mandates)
  .innerJoin(organs, eq(mandates.organId, organs.id))
  .where(sql`${mandates.actorId} IN ${deputyIds} AND ${organs.type} = 'GP'`)
  .orderBy(desc(mandates.startDate))  // ← FIX : Tri par date décroissante
```

Le code de lookup reste identique (premier = plus récent) :
```typescript
// Build lookup map - first entry for each actor wins (most recent due to ordering)
const groupByActor = new Map<...>();
for (const g of groupsData) {
  if (!groupByActor.has(g.actorId) && g.groupId) {
    groupByActor.set(g.actorId, { ... });  // Maintenant = le plus récent
  }
}
```

## Fichiers Corrigés

Le bug affectait **6 fichiers** avec le même pattern de requête :

1. `src/routes/an/deputes/+page.server.ts` - Liste des députés AN (SSR)
2. `src/routes/an/deputes/+server.ts` - API infinite scroll AN
3. `src/routes/pe/eurodeputes/+page.server.ts` - Liste eurodéputés (SSR)
4. `src/routes/pe/eurodeputes/+server.ts` - API infinite scroll PE
5. `src/routes/senat/senateurs/+page.server.ts` - Liste sénateurs (SSR)
6. `src/routes/senat/senateurs/+server.ts` - API infinite scroll Sénat

**Pattern de fix identique** appliqué aux 6 fichiers.

## Prévention

### Règle à adopter
**Toute requête récupérant des mandats doit être ordonnée par `startDate DESC`** pour garantir la cohérence temporelle.

### Checklist pour les requêtes mandats
- [ ] SELECT inclut `startDate` si besoin de trier
- [ ] `.orderBy(desc(mandates.startDate))` présent
- [ ] Commentaire indiquant "most recent first" pour clarté
- [ ] Test avec un acteur ayant plusieurs mandats

### Code Review Item
Lors de reviews de code manipulant des mandats, vérifier :
```typescript
// ❌ Red flag
.from(mandates)
.where(...)
// Pas de .orderBy() !

// ✅ OK
.from(mandates)
.where(...)
.orderBy(desc(mandates.startDate))
```

### Pattern à standardiser
```typescript
// Template pour queries de groupe parlementaire
const groupsData = await db
  .select({
    actorId: mandates.actorId,
    groupId: organs.id,
    groupName: organs.name,
    groupShortName: organs.shortName,
    groupColor: organs.color,
    startDate: mandates.startDate  // Pour le tri
  })
  .from(mandates)
  .innerJoin(organs, eq(mandates.organId, organs.id))
  .where(sql`${mandates.actorId} IN ${actorIds} AND ${organs.type} = 'GP'`)
  .orderBy(desc(mandates.startDate));  // TOUJOURS ordonner
```

## Impact

- **Utilisateurs** : Noms de groupes affichés correctement partout
- **Données** : Cohérence entre pages liste et pages profil
- **Scope** : 6 endpoints API/SSR corrigés
- **Risque résiduel** : Vérifier les autres requêtes de mandats (commissions, etc.)

## Tags
- Type: `data-consistency`
- Type: `sql-query-ordering`
- Module: `mandates`, `api-routes`
- Severity: `medium` (affichage incorrect mais pas de crash)

## Voir aussi
- Memory: `database-queries.md` - Patterns de requêtes DB
- Memory: `database-queries-factorization.md` - Factorisation des queries
- ADR: Potentiel ADR pour standardiser les queries de mandats

## Historique
| Date | Modification |
|------|--------------|
| 2026-02-01 | Création initiale suite à fix du bug PA841067 |
