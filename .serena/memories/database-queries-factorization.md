# Règle - Factorisation des requêtes base de données

**RÈGLE** : Toujours factoriser les requêtes DB répétées dans des helpers réutilisables.

## Principe

Si une requête ou logique de requête est utilisée dans plusieurs fichiers (ou pourrait l'être), elle doit être extraite dans un helper partagé.

## Emplacement des helpers

- `src/lib/server/api/helpers.ts` - Helpers pour les routes (requêtes communes aux pages)
- `src/lib/server/db/queries/` - Requêtes complexes réutilisables (si besoin de fichiers séparés)

## Exemples

### ❌ INTERDIT - Duplication de requêtes

```typescript
// /an/groupes/+page.server.ts
const groups = await db.select({...}).from(mandates).innerJoin(organs, ...).where(...);

// /an/carte/+page.server.ts
const groups = await db.select({...}).from(mandates).innerJoin(organs, ...).where(...); // Même logique !
```

### ✅ CORRECT - Helper factorisé

```typescript
// src/lib/server/api/helpers.ts
export async function getANGroupsWithMemberCount(
  legislature: string,
  referenceDate: string
): Promise<GroupWithMemberCount[]> {
  // Requête unique, testée, maintenue à un seul endroit
}

// /an/groupes/+page.server.ts
const groups = await getANGroupsWithMemberCount(legislature, referenceDate);

// /an/carte/+page.server.ts
const groups = await getANGroupsWithMemberCount(legislature, referenceDate);
```

## Avantages

1. **Cohérence** : Les mêmes données sont calculées de la même façon partout
2. **Maintenance** : Un bug corrigé à un endroit = corrigé partout
3. **Tests** : Un seul helper à tester
4. **Lisibilité** : Le code des routes reste simple et déclaratif

## Quand factoriser ?

- Dès qu'une requête est utilisée dans **2+ fichiers**
- Si une requête est **complexe** et pourrait être réutilisée
- Si la requête implémente une **logique métier** (ex: "membres actifs d'un groupe")

## Helpers existants

- `getANGroupsWithMemberCount()` - Groupes AN avec effectifs
- `mapVoteDistribution()` - Transformation des distributions de votes
- `getGroupMajorityPosition()` - Position majoritaire d'un groupe
